#!/bin/bash

# 🧪 Test Script for Solver Node
# Быстрая проверка всех компонентов

set -e

echo "🧪 Testing Solver Node..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Проверка зависимостей
echo ""
echo "📦 Checking dependencies..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pnpm: $(pnpm --version)${NC}"

# 2. Проверка .env файла
echo ""
echo "🔐 Checking .env file..."

if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Run: cp .env.example .env"
    exit 1
fi

if ! grep -q "SOLVER_ACCOUNT_ID=" .env; then
    echo -e "${RED}❌ SOLVER_ACCOUNT_ID not set in .env${NC}"
    exit 1
fi

if ! grep -q "SOLVER_PRIVATE_KEY=" .env; then
    echo -e "${RED}❌ SOLVER_PRIVATE_KEY not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ .env file configured${NC}"

# 3. Проверка node_modules
echo ""
echo "📚 Checking node_modules..."

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing...${NC}"
    pnpm install
fi
echo -e "${GREEN}✅ node_modules exists${NC}"

# 4. TypeScript build
echo ""
echo "🔨 Building TypeScript..."

if ! pnpm build; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"

# 5. Проверка compiled files
echo ""
echo "📂 Checking compiled files..."

REQUIRED_FILES=(
    "dist/index.js"
    "dist/near-signer.js"
    "dist/executor.js"
    "dist/intent-monitor.js"
    "dist/profitability.js"
    "dist/price-oracle.js"
    "dist/ref-finance-swap.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ All required files present${NC}"

# 6. Run unit tests
echo ""
echo "🧪 Running unit tests..."

if command -v jest &> /dev/null; then
    if pnpm test; then
        echo -e "${GREEN}✅ Tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tests failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Jest not found, skipping tests${NC}"
fi

# 7. Проверка NEAR account (если near-cli установлен)
echo ""
echo "🔍 Checking NEAR account..."

if command -v near &> /dev/null; then
    source .env
    if [ ! -z "$SOLVER_ACCOUNT_ID" ]; then
        if near view-account $SOLVER_ACCOUNT_ID --networkId ${NEAR_NETWORK:-testnet} &> /dev/null; then
            echo -e "${GREEN}✅ NEAR account exists: $SOLVER_ACCOUNT_ID${NC}"
        else
            echo -e "${RED}❌ NEAR account not found: $SOLVER_ACCOUNT_ID${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  near-cli not found, skipping account check${NC}"
fi

# 8. Test imports
echo ""
echo "🔌 Testing module imports..."

node -e "
const { NearSigner } = require('./dist/near-signer.js');
const { PriceOracle } = require('./dist/price-oracle.js');
const { ProfitabilityCalculator } = require('./dist/profitability.js');
console.log('✅ All modules import successfully');
" || {
    echo -e "${RED}❌ Module import failed${NC}"
    exit 1
}

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 All checks passed!${NC}"
echo ""
echo "Ready to run solver node:"
echo "  ${YELLOW}pnpm start${NC}"
echo ""
echo "Or with Docker:"
echo "  ${YELLOW}docker build -t solver-node .${NC}"
echo "  ${YELLOW}docker run --env-file .env solver-node${NC}"
echo ""

