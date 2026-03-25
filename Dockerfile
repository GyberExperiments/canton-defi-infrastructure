# 🚀 Canton OTC Exchange - Main Dockerfile
# This file references the optimized Dockerfile in config/docker/

# Use the optimized Dockerfile
FROM node:20-slim AS deps

# Install pnpm and build tools
# ✅ Добавлен openssl и libssl-dev для поддержки Prisma и других нативных модулей
RUN npm install -g pnpm && \
    apt-get update && \
    apt-get install -y python3 make g++ openssl libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies with pnpm (much faster)
RUN echo "📦 Installing dependencies with pnpm..." && \
    (if [ -f pnpm-lock.yaml ]; then \
        pnpm install --frozen-lockfile --prod=false; \
    else \
        echo "⚠️ pnpm-lock.yaml not found, using npm install..." && \
        npm install --legacy-peer-deps --prefer-offline --no-audit --no-fund; \
    fi)

# Stage 2: Build
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code
COPY . .

# Set build environment
ENV HD_WALLET_SEED="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
ENV NODE_ENV=production
# Оптимизированный лимит памяти для Node.js сборки
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Build application
RUN echo "🔨 Building Next.js application..." && \
    (if [ -f pnpm-lock.yaml ]; then \
        pnpm build; \
    else \
        npm run build; \
    fi)

# Stage 3: Production
FROM node:20-slim AS runner

# Install runtime dependencies
# ✅ Добавлен openssl для runtime (на случай Prisma и других библиотек)
RUN apt-get update && \
    apt-get install -y libc6 openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# ✅ Копируем @supabase/supabase-js для server-side операций (dynamic import)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@supabase ./node_modules/@supabase

# Create data directory for conversation storage
RUN mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data && \
    chmod -R 755 /app/data

# Switch to non-root user
USER nextjs

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
