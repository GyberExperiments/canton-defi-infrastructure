# NEAR Intents DEX - Инструкция по деплою

## 📋 Краткий обзор функционала

Страница `/dex` предоставляет:

1. **Swap Interface** - Обмен токенов между сетями (NEAR, USDT, USDC, ETH)
   - Комиссия DEX: **0.3%**
   - Автоматический расчет выходной суммы

2. **Bridge Interface** - Мостовые операции между блокчейнами
   - Поддержка: NEAR, Aurora, Ethereum, Polygon, BSC
   - Комиссия DEX: **0.5%**

3. **Интеграция с NEAR Wallet** - Подключение кошелька пользователя

## 🔐 Настройка секретов и переменных

### Архитектура хранения:

- **GitHub Secrets** → Критичные секреты (API ключи, токены)
  - Автоматически синхронизируются в Kubernetes через External Secrets Operator
  - НЕ хранятся в ConfigMap
  
- **ConfigMap** → Некритичные переменные (URLs, адреса контрактов, настройки)
  - Можно менять из админки
  - Обновляются через `kubectl apply`

### Шаг 1: GitHub Secrets (критичные секреты)

Если NEAR Intents предоставляет REST API с API ключом:

1. Перейдите: https://github.com/TheMacroeconomicDao/CantonOTC/settings/secrets/actions
2. Нажмите **"New repository secret"**
3. Добавьте:
   ```
   Name: NEAR_INTENTS_API_KEY
   Value: ваш_api_ключ_здесь
   ```
4. Нажмите **"Add secret"**

**Примечание:** Если NEAR Intents не использует REST API, этот секрет не требуется.

### Шаг 2: Обновить External Secret

Файл: `config/kubernetes/k8s/minimal-stage/external-secret.yaml`

Уже обновлен, включает:
```yaml
  # NEAR Intents интеграция
  - secretKey: NEAR_INTENTS_API_KEY
    remoteRef:
      key: NEAR_INTENTS_API_KEY
```

Применить:
```bash
kubectl apply -f config/kubernetes/k8s/minimal-stage/external-secret.yaml
```

### Шаг 3: Обновить ConfigMap (некритичные переменные)

Файлы уже обновлены:
- `config/kubernetes/k8s/configmap.yaml` (production)
- `config/kubernetes/k8s/minimal-stage/configmap.yaml` (staging)

Содержат:
```yaml
NEXT_PUBLIC_NEAR_NETWORK: "mainnet"  # или "testnet"
NEAR_INTENTS_VERIFIER_CONTRACT: "verifier.mainnet"  # ⚠️ НУЖНО ПОЛУЧИТЬ
NEAR_RPC_URL: "https://rpc.mainnet.near.org"
NEAR_ARCHIVAL_RPC_URL: "https://archival-rpc.mainnet.near.org"
NEAR_WALLET_URL: "https://wallet.near.org"
```

**Обновить адрес контракта:**
1. Получить актуальный адрес verifier контракта от NEAR Intents
2. Отредактировать ConfigMap:
   ```bash
   kubectl edit configmap canton-otc-config -n canton-otc-minimal-stage
   ```
3. Или обновить файл и применить:
   ```bash
   kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml
   ```

## 🚀 Deployment Checklist

- [ ] Получен адрес `NEAR_INTENTS_VERIFIER_CONTRACT` от NEAR Intents
- [ ] Обновлен ConfigMap с актуальным адресом контракта
- [ ] Если есть API ключ → добавлен в GitHub Secrets
- [ ] External Secret обновлен (уже сделано)
- [ ] ConfigMap применен в кластер
- [ ] Протестировано на testnet/minimal-stage
- [ ] Проверено создание swap intents
- [ ] Проверено создание bridge intents

## 📝 Важные замечания

1. **Адрес Verifier контракта** - это НЕ секрет, можно хранить в ConfigMap
2. **RPC URLs** - публичные endpoints, не требуют ключей
3. **API ключ** - только если NEAR Intents имеет REST API (не обязательно)


