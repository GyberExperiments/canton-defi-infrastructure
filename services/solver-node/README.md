# 🔧 1OTC Solver Node

Автоматический исполнитель NEAR Intents для 1OTC DEX.

## 📋 Описание

Solver Node автоматически сканирует блокчейн NEAR на наличие новых pending intents, проверяет их прибыльность и исполняет через DEX.

## 🚀 Быстрый Старт

### 1. Установка зависимостей

```bash
cd services/solver-node
pnpm install
```

### 2. Настройка Environment Variables

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Обязательные переменные:
- `SOLVER_ACCOUNT_ID` - NEAR account который будет исполнять intents
- `SOLVER_PRIVATE_KEY` - Private key для подписания транзакций

### 3. Сборка

```bash
pnpm build
```

### 4. Запуск

```bash
# Production
pnpm start

# Development (с hot reload)
pnpm dev
```

## 🏗️ Архитектура

```
IntentMonitor
    ↓
ProfitabilityCalculator
    ↓
IntentExecutor
    ↓
NEAR Intents Contract + DEX
```

### Компоненты:

1. **IntentMonitor** - Сканирует новые intents каждые 2 секунды
2. **ProfitabilityCalculator** - Рассчитывает прибыльность исполнения
3. **IntentExecutor** - Исполняет profitable intents через DEX
4. **PriceOracle** - Получает реальные цены для расчета прибыльности

## ⚙️ Конфигурация

### Environment Variables:

```env
# NEAR Network
NEAR_NETWORK=testnet
NEAR_RPC_URL=https://rpc.testnet.near.org
NEAR_INTENTS_CONTRACT=verifier.testnet

# Solver Account
SOLVER_ACCOUNT_ID=your-solver.testnet
SOLVER_PRIVATE_KEY=your-private-key

# Solver Settings
SOLVER_MIN_PROFIT_THRESHOLD=0.1      # Минимальная прибыль в NEAR
SOLVER_POLLING_INTERVAL=2000         # Интервал проверки (мс)
SOLVER_MAX_GAS_COST=0.01             # Максимальная стоимость gas

# Price Oracle
PRICE_ORACLE_ENABLED=true
REF_FINANCE_API=https://indexer.ref-finance.near.org
```

## 📊 Как Это Работает

1. **Мониторинг**: Solver каждые 2 секунды проверяет новые pending intents
2. **Фильтрация**: Отфильтровывает невалидные и истекшие intents
3. **Прибыльность**: Рассчитывает прибыльность для каждого intent
4. **Исполнение**: Исполняет profitable intents через REF Finance
5. **Подтверждение**: Подтверждает исполнение в контракте

## 💰 Экономика

Solver зарабатывает на разнице между:
- Фактической ценой обмена на DEX
- Минимальной суммой которую нужно вернуть пользователю (min_receive)

**Пример:**
- Intent: 100 NEAR → min 10,000 USDT
- Цена на DEX: 101 USDT за NEAR = 10,100 USDT
- Прибыль: 10,100 - 10,000 - 1 (gas) = 99 USDT ✅

## ⚠️ Текущие Ограничения

1. **Исполнение через DEX** - пока не реализовано полностью (stub)
   - Нужна интеграция с REF Finance для реального swap
   - Нужно подписание транзакций с solver private key

2. **Получение intents** - метод `get_pending_intents` может не существовать
   - Нужен альтернативный способ (events, indexing)

3. **Gas оптимизация** - не оптимизировано
   - Можно улучшить batch execution

## 🔜 TODO

- [ ] Реальное исполнение через REF Finance
- [ ] Альтернативный способ получения intents (events)
- [ ] Поддержка batch execution
- [ ] Мониторинг и метрики
- [ ] Health checks
- [ ] Rate limiting для API calls

## 📚 Дополнительная Документация

- [Solver System Explained](../../docs/SOLVER_SYSTEM_EXPLAINED.md) - Подробное объяснение
- [DEX Implementation Roadmap](../../docs/DEX_IMPLEMENTATION_ROADMAP.md) - Общий план

## 🤝 Вклад

Для улучшения solver node:
1. Реализуйте `swapThroughRefFinance` в `executor.ts`
2. Добавьте альтернативный способ получения intents
3. Оптимизируйте gas costs
4. Добавьте тесты

---

**Status:** 🟡 Work in Progress  
**Last Updated:** November 2, 2025

