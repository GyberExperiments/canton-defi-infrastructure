# NEAR Intents DEX - Production Setup Guide

## 📋 Функциональность страницы `/dex`

### Основные возможности:

1. **Swap Interface** - Обмен токенов между сетями
   - Поддержка: NEAR, USDT, USDC, ETH
   - Комиссия DEX: 0.3%
   - Автоматический расчет выходной суммы
   - Подключение NEAR кошелька

2. **Bridge Interface** - Мостовые операции между блокчейнами
   - Поддержка сетей: NEAR, Aurora, Ethereum, Polygon, BSC
   - Комиссия DEX: 0.5%
   - Валидация разных сетей

3. **NEAR Wallet Integration**
   - Подключение через @near-wallet-selector
   - Сохранение состояния подключения
   - Автоматическая проверка подключения

### Техническая реализация:

- **Боевая интеграция** через NEAR RPC и смарт-контракты
- **API Routes** с полной валидацией и error handling
- **Комиссии** вычисляются на сервере и вычитаются из суммы
- **Безопасность**: Валидация всех входных данных, rate limiting готов

## 🔐 Необходимые креды для Production

### ⚠️ ВАЖНО: Архитектура секретов проекта

В этом проекте критичные секреты хранятся в **GitHub Secrets** и автоматически синхронизируются в Kubernetes через External Secrets Operator. Некритичные переменные хранятся в **ConfigMap** и могут меняться из админки.

### Шаг 1: Добавить критичные секреты в GitHub Secrets

**Критичные секреты** (хранятся в GitHub Secrets → синхронизируются в Kubernetes):

1. Перейдите: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions
2. Добавьте следующие секреты:

```bash
# NEAR Intents API Key (если есть публичный REST API)
NEAR_INTENTS_API_KEY=your_api_key_here
```

**Примечание:** Если NEAR Intents не имеет публичного REST API, этот секрет не требуется.

### Шаг 2: Обновить External Secret для синхронизации

Добавьте в `config/kubernetes/k8s/minimal-stage/external-secret.yaml`:

```yaml
  # NEAR Intents интеграция (если есть API ключ)
  - secretKey: NEAR_INTENTS_API_KEY
    remoteRef:
      key: NEAR_INTENTS_API_KEY
```

Затем примените:
```bash
kubectl apply -f config/kubernetes/k8s/minimal-stage/external-secret.yaml
```

### Шаг 3: Добавить некритичные переменные в ConfigMap

**Некритичные переменные** (хранятся в ConfigMap → можно менять из админки):

Обновите `config/kubernetes/k8s/configmap.yaml` или `config/kubernetes/k8s/minimal-stage/configmap.yaml`:

```yaml
  # ========================================
  # NEAR INTENTS КОНФИГУРАЦИЯ (НЕСЕКРЕТНЫЕ)
  # ========================================
  NEXT_PUBLIC_NEAR_NETWORK: "mainnet"  # или "testnet" для тестирования
  NEAR_INTENTS_VERIFIER_CONTRACT: "verifier.mainnet"  # Адрес контракта (получить от NEAR Intents)
  NEAR_RPC_URL: "https://rpc.mainnet.near.org"
  NEAR_ARCHIVAL_RPC_URL: "https://archival-rpc.mainnet.near.org"
  NEAR_WALLET_URL: "https://wallet.near.org"
  
  # Опционально: Если есть публичный API NEAR Intents
  NEAR_INTENTS_API_URL: "https://api.near-intents.org/v1"
```

Примените ConfigMap:
```bash
kubectl apply -f config/kubernetes/k8s/configmap.yaml
# или для minimal-stage:
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml
```

### Получение кредов:

1. **NEAR Network**
   - Используйте `testnet` для разработки
   - Используйте `mainnet` для production
   - RPC endpoints публичные, не требуют ключей

2. **Verifier Contract Address**
   - Нужно получить актуальный адрес контракта verifier от NEAR Intents
   - Проверить на: https://docs.near-intents.org или GitHub репозитории
   - Для testnet обычно: `verifier.testnet`
   - Для mainnet: получить от команды NEAR Intents
   - Это не секрет, можно хранить в ConfigMap

3. **NEAR Intents API Key** (опционально, только если есть REST API)
   - Если есть публичный REST API
   - Получить через регистрацию на https://docs.near-intents.org
   - Или через контакт с командой NEAR Intents
   - **Критичный секрет** → хранить в GitHub Secrets

## ⚙️ Что нужно сделать перед Production:

1. **Получить адрес Verifier контракта**
   - Связаться с командой NEAR Intents или проверить документацию
   - Убедиться что контракт развернут на нужной сети (mainnet/testnet)
   - Добавить в ConfigMap (не секрет)

2. **Добавить критичные секреты в GitHub Secrets**
   - Перейти: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions
   - Добавить `NEAR_INTENTS_API_KEY` (если есть REST API)
   - External Secret уже обновлен в `external-secret.yaml`

3. **Обновить ConfigMap с NEAR настройками**
   - Добавить `NEXT_PUBLIC_NEAR_NETWORK`, `NEAR_INTENTS_VERIFIER_CONTRACT`, RPC URLs
   - Применить через `kubectl apply` или через админку
   - Проверить корректность всех значений

3. **Интегрировать @near-wallet-selector** (рекомендуется)
   ```bash
   pnpm add @near-wallet-selector/core @near-wallet-selector/modal-ui @near-wallet-selector/wallets
   ```
   - Обновить `NearWalletButton.tsx` для использования selector
   - Это улучшит UX подключения кошелька

4. **Тестирование на testnet**
   - Проверить создание swap intents
   - Проверить создание bridge intents
   - Проверить получение статуса intents
   - Убедиться что комиссии корректно вычисляются

5. **Мониторинг**
   - Настроить логирование всех intent операций
   - Отслеживать ошибки контрактных вызовов
   - Мониторить комиссии и прибыль DEX

## 🔧 Дополнительные настройки:

### Изменение комиссий:

В компонентах `SwapInterface.tsx` и `BridgeInterface.tsx`:
```typescript
const [fee, setFee] = useState<number>(0.003) // 0.3% для swap
const [fee, setFee] = useState<number>(0.005) // 0.5% для bridge
```

### Добавление новых токенов:

В `SwapInterface.tsx` обновить массив `SUPPORTED_TOKENS`:
```typescript
const SUPPORTED_TOKENS: Token[] = [
  // Добавить новые токены с chain и decimals
]
```

### Добавление новых сетей для Bridge:

В `BridgeInterface.tsx` обновить массив `SUPPORTED_CHAINS`:
```typescript
const SUPPORTED_CHAINS: Chain[] = [
  // Добавить новые сети
]
```

## 📝 Важные замечания:

1. **Текущая реализация** использует прямые вызовы через NEAR RPC
2. **Транзакции требуют подписи** пользователем через кошелек
3. **Комиссии настраиваются** на уровне компонентов
4. **Все валидации** выполняются на сервере для безопасности

## 🚀 Deployment Checklist:

- [ ] Получен адрес Verifier контракта для mainnet от NEAR Intents
- [ ] Обновлен ConfigMap с актуальным адресом контракта
- [ ] Если есть REST API → добавлен `NEAR_INTENTS_API_KEY` в GitHub Secrets
- [ ] External Secret обновлен (уже сделано в `external-secret.yaml`)
- [ ] ConfigMap применен: `kubectl apply -f config/kubernetes/k8s/configmap.yaml`
- [ ] Deployment обновлен и применен (переменные уже добавлены в deployment.yaml)
- [ ] Протестировано на testnet/minimal-stage
- [ ] Интегрирован @near-wallet-selector (опционально)
- [ ] Настроен мониторинг и логирование
- [ ] Проверена безопасность и валидация

