# NEAR Intents DEX - Функционал и требования для Production

## 📋 Функционал страницы `/dex`

### Основные возможности:

1. **Swap Interface** 
   - Обмен токенов: NEAR, USDT, USDC, ETH
   - Комиссия DEX: **0.3%** (вычитается автоматически)
   - Автоматический расчет выходной суммы
   - Поддержка разных сетей

2. **Bridge Interface**
   - Мост между блокчейнами: NEAR, Aurora, Ethereum, Polygon, BSC
   - Комиссия DEX: **0.5%** (вычитается автоматически)
   - Валидация разных сетей

3. **NEAR Wallet Integration**
   - Подключение через кошелек пользователя
   - Сохранение состояния подключения
   - Автоматическая проверка

### Технические особенности:

- ✅ **Боевая реализация** через NEAR RPC (`@near-js/client`)
- ✅ Интеграция со смарт-контрактами verifier
- ✅ Комиссии вычисляются на сервере
- ✅ Полная валидация и error handling
- ✅ Соответствие архитектуре проекта

---

## 🔐 Необходимые креды для Production

### ⚠️ Архитектура хранения секретов проекта:

- **GitHub Secrets** → Критичные секреты (API ключи, токены)
  - Автоматически синхронизируются в Kubernetes через External Secrets Operator
  
- **ConfigMap** → Некритичные переменные (URLs, адреса контрактов)
  - Можно менять из админки
  - Обновляются через `kubectl apply`

---

### Шаг 1: GitHub Secrets (критичные секреты)

**Если NEAR Intents имеет REST API с API ключом:**

1. Перейдите: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions
2. Добавьте секрет:
   ```
   Name: NEAR_INTENTS_API_KEY
   Value: ваш_api_ключ
   ```

**✅ External Secret уже обновлен** - синхронизация настроена автоматически.

**Примечание:** Если NEAR Intents работает только через смарт-контракты (без REST API), этот секрет не требуется.

---

### Шаг 2: ConfigMap (некритичные переменные)

**✅ ConfigMap уже обновлен** со следующими переменными:

**Для Production** (`config/kubernetes/k8s/configmap.yaml`):
```yaml
NEXT_PUBLIC_NEAR_NETWORK: "mainnet"
NEAR_INTENTS_VERIFIER_CONTRACT: "verifier.mainnet"  # ⚠️ ПОЛУЧИТЬ ОТ NEAR INTENTS
NEAR_RPC_URL: "https://rpc.mainnet.near.org"
NEAR_ARCHIVAL_RPC_URL: "https://archival-rpc.mainnet.near.org"
NEAR_WALLET_URL: "https://wallet.near.org"
NEAR_INTENTS_API_URL: "https://api.near-intents.org/v1"
```

**Для Staging** (`config/kubernetes/k8s/minimal-stage/configmap.yaml`):
```yaml
NEXT_PUBLIC_NEAR_NETWORK: "testnet"
NEAR_INTENTS_VERIFIER_CONTRACT: "verifier.testnet"  # ⚠️ ПОЛУЧИТЬ ОТ NEAR INTENTS
NEAR_RPC_URL: "https://rpc.testnet.near.org"
# ... и т.д.
```

**✅ Deployment уже обновлен** - переменные подключены из ConfigMap/Secrets.

---

## 📝 Что нужно сделать:

### Обязательно:

1. **Получить адрес Verifier контракта** от NEAR Intents
   - Проверить: https://docs.near-intents.org
   - Или связаться с командой NEAR Intents
   - Обновить значение `NEAR_INTENTS_VERIFIER_CONTRACT` в ConfigMap

2. **Применить ConfigMap в кластер:**
   ```bash
   # Для staging
   kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml
   
   # Для production
   kubectl apply -f config/kubernetes/k8s/configmap.yaml
   ```

3. **Если есть REST API** - добавить `NEAR_INTENTS_API_KEY` в GitHub Secrets

### Опционально:

- Интегрировать `@near-wallet-selector` для улучшенного UX
- Настроить price oracles для реальных курсов обмена
- Добавить мониторинг intent операций

---

## ✅ Что уже готово:

- ✅ Все компоненты созданы (Swap, Bridge, Wallet)
- ✅ API routes с боевой интеграцией через NEAR RPC
- ✅ ConfigMap обновлен с NEAR переменными
- ✅ Deployment обновлен (переменные подключены)
- ✅ External Secret обновлен (для синхронизации API ключа)
- ✅ Документация создана

---

## 🚀 Быстрый старт:

1. Получить адрес `NEAR_INTENTS_VERIFIER_CONTRACT`
2. Обновить ConfigMap с адресом
3. Применить ConfigMap: `kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml`
4. Перезапустить deployment для применения переменных
5. Протестировать на staging/testnet

Готово! Страница `/dex` будет доступна после деплоя.


