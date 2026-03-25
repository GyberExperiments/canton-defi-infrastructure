# 🚀 Canton OTC - Локальный запуск

## 📋 Системные требования

| Компонент | Версия | Команда проверки |
|-----------|--------|------------------|
| Node.js | 20.x+ | `node -v` |
| pnpm | 8.x+ | `pnpm -v` |
| Docker | 20.x+ | `docker -v` |
| Git | любая | `git --version` |

---

## 🔧 Способ 1: Запуск напрямую (Dev Mode)

### Шаг 1: Установка зависимостей ОС

**macOS:**
```bash
# Homebrew
brew install node@20
npm install -g pnpm
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm
```

**Windows:**
- Скачать Node.js 20 LTS: https://nodejs.org/
- `npm install -g pnpm`

### Шаг 2: Клонирование

```bash
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git canton-otc
cd canton-otc
```

### Шаг 3: Конфигурация

```bash
# Копируем template
cp env.template .env.local
```

**Минимальные обязательные переменные в `.env.local`:**

```env
# Auth (ОБЯЗАТЕЛЬНО)
NEXTAUTH_SECRET=your-random-secret-key-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000

# HD Wallet (для сборки)
HD_WALLET_SEED=abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about

# NEAR (для DEX)
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEAR_RPC_URL=https://rpc.testnet.near.org

# Mock modes (для локальной работы)
NEXT_PUBLIC_CANTON_ENABLE_REAL_API=false
NEXT_PUBLIC_CANTON_USE_MOCK_FALLBACK=true
NEXT_PUBLIC_DAML_USE_REAL_LEDGER=false
NEXT_PUBLIC_DAML_USE_MOCK_FALLBACK=true
NEXT_PUBLIC_ZK_USE_REAL_SNARKJS=false
NEXT_PUBLIC_ZK_USE_MOCK_FALLBACK=true
ENABLE_MOCK_FALLBACK=true
```

### Шаг 4: Установка и запуск

```bash
pnpm install
pnpm dev
```

### Шаг 5: Проверка

- Главная: http://localhost:3000
- DEX: http://localhost:3000/dex
- Health: http://localhost:3000/api/health

---

## 🐳 Способ 2: Docker (Production Mode)

### Шаг 1: Создать .env.local

```bash
cp env.template .env.local
# Отредактировать минимальные переменные (см. выше)
```

### Шаг 2: Сборка Docker образа

```bash
# Из корня проекта
docker build -f config/docker/Dockerfile -t canton-otc:local .
```

### Шаг 3: Запуск контейнера

```bash
docker run -d \
  --name canton-otc \
  -p 3000:3000 \
  --env-file .env.local \
  canton-otc:local
```

### Шаг 4: Проверка

```bash
# Статус контейнера
docker ps

# Логи
docker logs -f canton-otc

# Health check
curl http://localhost:3000/api/health
```

### Остановка и удаление

```bash
docker stop canton-otc
docker rm canton-otc
```

---

## 🐳 Способ 3: Docker Compose (рекомендуется для production-like)

### Создать `docker-compose.yml`:

```yaml
version: '3.8'

services:
  canton-otc:
    build:
      context: .
      dockerfile: config/docker/Dockerfile
    container_name: canton-otc
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Опционально: Redis для rate limiting
  redis:
    image: redis:7-alpine
    container_name: canton-otc-redis
    ports:
      - "6379:6379"
    restart: unless-stopped
```

### Запуск:

```bash
# Сборка и запуск
docker-compose up -d --build

# Логи
docker-compose logs -f canton-otc

# Остановка
docker-compose down
```

---

## 📝 Команды одной строкой (copy-paste)

### Dev Mode:
```bash
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git canton-otc && cd canton-otc && cp env.template .env.local && pnpm install && pnpm dev
```

### Docker:
```bash
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git canton-otc && cd canton-otc && cp env.template .env.local && docker build -f config/docker/Dockerfile -t canton-otc:local . && docker run -d --name canton-otc -p 3000:3000 --env-file .env.local canton-otc:local
```

---

## 🔧 Решение проблем

### Ошибка "peer dependency"
```bash
pnpm install --shamefully-hoist
# или
npm install --legacy-peer-deps
```

### Ошибка "memory allocation" при сборке
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm build
```

### Ошибка "NEXTAUTH_SECRET"
Добавить в `.env.local`:
```env
NEXTAUTH_SECRET=any-random-string-at-least-32-characters-long
```

### Warnings про @wagmi/connectors
Это **НЕ ошибки**! Это optional peer dependencies для specific wallet SDKs (MetaMask SDK, Coinbase, WalletConnect). Приложение работает без них.

### Docker: "Cannot find module"
Пересобрать образ:
```bash
docker build --no-cache -f config/docker/Dockerfile -t canton-otc:local .
```

### Первый запрос медленный (20-30 сек)
Это нормально для dev mode — происходит JIT-компиляция. В production (Docker) страницы pre-built и загружаются мгновенно.

---

## 📊 Endpoints для проверки

| Endpoint | Описание |
|----------|----------|
| http://localhost:3000 | Главная страница OTC |
| http://localhost:3000/dex | DEX интерфейс |
| http://localhost:3000/api/health | Health check (JSON) |
| http://localhost:3000/api/config | Текущая конфигурация |

---

## 🔒 Production checklist

Перед production deploy убедитесь что:

- [ ] `NEXTAUTH_SECRET` — уникальный случайный ключ (32+ символов)
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — получен на https://cloud.walletconnect.com/
- [ ] Mock modes отключены (`ENABLE_MOCK_FALLBACK=false`)
- [ ] Redis настроен для rate limiting
- [ ] HTTPS настроен (через reverse proxy)

---

**Версия документа:** 2026-01-24
