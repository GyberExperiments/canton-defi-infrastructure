# 🔧 Solver Node - Troubleshooting Guide

**Последнее обновление**: 2 Ноября 2025

---

## 🆘 ЧАСТЫЕ ПРОБЛЕМЫ

### 1. "SOLVER_PRIVATE_KEY is required"

**Симптомы:**
```
❌ SOLVER_PRIVATE_KEY is required
   Please set SOLVER_PRIVATE_KEY in .env file
   Format: ed25519:...
```

**Причина:** Environment variable не установлена

**Решение:**
```bash
# 1. Проверить .env файл
cat .env | grep SOLVER_PRIVATE_KEY

# 2. Если пустой - добавить
echo 'SOLVER_PRIVATE_KEY=ed25519:your-key-here' >> .env

# 3. Получить private key
cat ~/.near-credentials/testnet/your-solver.testnet.json | jq -r '.private_key'

# 4. Проверить формат (должен начинаться с ed25519:)
```

---

### 2. "Failed to initialize NEAR Signer"

**Симптомы:**
```
❌ Failed to initialize NEAR Signer: Invalid key format
```

**Причина:** Неправильный формат private key

**Решение:**
```bash
# Private key должен быть в формате:
# ed25519:base58-encoded-key

# Неправильно:
SOLVER_PRIVATE_KEY=5JxLKbH...

# Правильно:
SOLVER_PRIVATE_KEY=ed25519:5JxLKbH...

# Проверка формата
if [[ $SOLVER_PRIVATE_KEY == ed25519:* ]]; then
  echo "✅ Format correct"
else
  echo "❌ Must start with 'ed25519:'"
fi
```

---

### 3. "Insufficient balance"

**Симптомы:**
```
❌ Insufficient balance: have 0, need 1000000000000000000000000
```

**Причина:** У solver account недостаточно токенов для swap

**Решение:**
```bash
# 1. Проверить баланс NEAR
near view-account your-solver.testnet --networkId testnet

# 2. Проверить баланс токенов (wrap.near для NEAR swaps)
near view wrap.near ft_balance_of \
  '{"account_id":"your-solver.testnet"}' \
  --networkId testnet

# 3. Пополнить NEAR (testnet faucet)
# https://near-faucet.io/

# 4. Wrapped NEAR (для swaps)
near call wrap.near near_deposit \
  '{}' \
  --accountId your-solver.testnet \
  --amount 10 \
  --networkId testnet
```

---

### 4. "No liquidity pool found"

**Симптомы:**
```
❌ No liquidity pool found for this token pair
```

**Причина:** Токен пара не имеет пула на REF Finance

**Решение:**
```bash
# 1. Проверить доступные пулы
curl https://indexer.ref-finance.near.org/list-pools | jq '.[] | select(.token_account_ids | contains(["wrap.near", "usdt.tether-token.near"]))'

# 2. Поддерживаемые пары (testnet):
# - wrap.near / usdt.tether-token.near
# - wrap.near / usdc.fair-launch.testnet
# - wrap.near / aurora

# 3. Если нужен новый пул - создать на ref.finance
```

---

### 5. "Transaction failed"

**Симптомы:**
```
❌ Transaction failed: Account does not have enough balance
```

**Причины:**
- Недостаточно NEAR для gas
- Slippage слишком большой
- Deadline истек
- Pool недостаточно ликвидности

**Решение:**
```bash
# 1. Проверить NEAR баланс
near state your-solver.testnet --networkId testnet

# Должно быть минимум 1 NEAR для gas

# 2. Увеличить max gas cost
echo 'SOLVER_MAX_GAS_COST=0.02' >> .env

# 3. Уменьшить min profit threshold (меньше конкуренция)
echo 'SOLVER_MIN_PROFIT_THRESHOLD=0.05' >> .env

# 4. Перезапустить
pnpm start
```

---

### 6. Intent Monitor не видит intents

**Симптомы:**
```
📋 Found 0 pending intents
📋 Found 0 pending intents
📋 Found 0 pending intents
```

**Причина:** 
- Контракт не возвращает intents
- Метод get_pending_intents не существует
- Network issues

**Решение:**
```bash
# 1. Проверить что контракт доступен
near view verifier.testnet get_intent_status \
  '{"intent_id":"test"}' \
  --networkId testnet

# 2. Проверить есть ли intents вообще
# (создать test intent через frontend)

# 3. Проверить polling interval
echo 'SOLVER_POLLING_INTERVAL=1000' >> .env

# 4. Проверить network
ping rpc.testnet.near.org

# 5. Если метод не существует - использовать альтернативный подход
# См. src/intent-monitor.ts для fallback логики
```

---

### 7. "TypeError: Cannot read property 'amount_out'"

**Симптомы:**
```
TypeError: Cannot read property 'amount_out' of undefined
```

**Причина:** Receipt parsing failed

**Решение:**
```bash
# 1. Проверить логи транзакции
# Найти transaction hash в логах:
# ✅ Transaction successful: hash_xyz

# 2. Посмотреть на explorer
# https://explorer.testnet.near.org/transactions/hash_xyz

# 3. Проверить формат receipt
# Обновить extractAmountOutFromReceipt в ref-finance-swap.ts

# 4. Временное решение - игнорировать amount_out
# Intent все равно будет fulfilled
```

---

### 8. Solver зависает / не отвечает

**Симптомы:**
- Нет новых логов
- CPU 0%
- Не реагирует на SIGTERM

**Решение:**
```bash
# 1. Проверить процесс
ps aux | grep "node dist/index.js"

# 2. Kill gracefully
kill -SIGTERM <PID>

# 3. Если не помогло - force kill
kill -9 <PID>

# 4. Проверить логи на deadlock
tail -100 logs/solver.log | grep -i "error\|stuck\|timeout"

# 5. Restart с debug logging
LOG_LEVEL=debug pnpm start
```

---

### 9. "Rate limit exceeded" от REF Finance

**Симптомы:**
```
❌ REF Finance API error: 429
```

**Причина:** Слишком много запросов к REF Finance API

**Решение:**
```bash
# 1. Увеличить polling interval
echo 'SOLVER_POLLING_INTERVAL=5000' >> .env

# 2. Добавить rate limiting
# В price-oracle.ts добавить delays между запросами

# 3. Использовать caching
# Кешировать pool IDs на 5 минут

# 4. Альтернативный источник
# Использовать on-chain view вместо API
```

---

### 10. Memory Leak

**Симптомы:**
- Memory usage растет со временем
- Solver становится медленнее
- Eventually crashes

**Решение:**
```bash
# 1. Проверить memory usage
docker stats solver-node

# или
ps aux | grep "node dist/index.js"

# 2. Добавить --max-old-space-size
# В package.json:
"start": "node --max-old-space-size=512 dist/index.js"

# 3. Restart периодически (K8s)
# Добавить в deployment.yaml:
spec:
  template:
    metadata:
      annotations:
        restart-timestamp: "$(date +%s)"

# 4. Проверить memory leaks
npm install -g clinic
clinic doctor -- node dist/index.js
```

---

## 🔍 ДИАГНОСТИКА

### Проверка Логов

```bash
# Local
tail -f logs/solver.log

# Docker
docker logs solver-node -f --tail=100

# Kubernetes
kubectl logs -n canton-otc deployment/solver-node -f --tail=100

# Фильтр только ошибки
kubectl logs -n canton-otc deployment/solver-node --tail=500 | grep -i "error\|failed\|❌"
```

### Проверка Статуса

```bash
# Проверить что процесс запущен
ps aux | grep "node dist/index.js"

# Проверить CPU/Memory
top -p $(pgrep -f "node dist/index.js")

# Проверить network connections
netstat -an | grep ESTABLISHED | grep 443

# Проверить disk space
df -h
```

### Проверка NEAR Account

```bash
# Account state
near state your-solver.testnet --networkId testnet

# Recent transactions
near tx-status <transaction_hash> --accountId your-solver.testnet

# Keys
near list-keys your-solver.testnet --networkId testnet
```

---

## 🧪 DEBUG MODE

### Включить детальные логи:

```bash
# 1. В .env
echo 'LOG_LEVEL=debug' >> .env

# 2. Restart
pnpm start

# Вывод будет включать:
# - Все RPC calls
# - Все price oracle requests
# - Детальные transaction receipts
# - Stack traces для ошибок
```

### Dry Run Mode (без реальных транзакций):

```typescript
// В executor.ts добавить:
const DRY_RUN = process.env.DRY_RUN === 'true'

if (DRY_RUN) {
  console.log('🔍 DRY RUN: Would execute intent', intent)
  return { success: true, intentId: intent.intent_id }
}

// Запуск:
DRY_RUN=true pnpm start
```

---

## 📊 HEALTH CHECKS

### Скрипт для проверки здоровья:

```bash
#!/bin/bash
# health-check.sh

SOLVER_PID=$(pgrep -f "node dist/index.js")

if [ -z "$SOLVER_PID" ]; then
  echo "❌ Solver not running"
  exit 1
fi

# Проверить что логи обновляются
LAST_LOG=$(tail -1 logs/solver.log)
LAST_LOG_TIME=$(echo "$LAST_LOG" | grep -oP '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}')

if [ -z "$LAST_LOG_TIME" ]; then
  echo "⚠️  No recent logs"
  exit 1
fi

# Проверить timestamp (не старше 30 секунд)
CURRENT_TIME=$(date -u +%s)
LOG_TIME=$(date -d "$LAST_LOG_TIME" +%s 2>/dev/null || echo 0)
TIME_DIFF=$((CURRENT_TIME - LOG_TIME))

if [ $TIME_DIFF -gt 30 ]; then
  echo "⚠️  Logs stale (${TIME_DIFF}s old)"
  exit 1
fi

echo "✅ Solver healthy"
exit 0
```

---

## 🆘 EMERGENCY RECOVERY

### Если solver завис:

```bash
#!/bin/bash
# emergency-restart.sh

echo "🆘 Emergency Restart"

# 1. Остановить solver
pkill -9 -f "node dist/index.js"

# 2. Очистить lock files
rm -f /tmp/solver-*.lock

# 3. Проверить disk space
df -h | grep -E "/$|/tmp"

# 4. Очистить старые логи
find logs/ -name "*.log" -mtime +7 -delete

# 5. Restart
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/services/solver-node
pnpm start &

echo "✅ Restarted"
```

### Если stuck intents:

```bash
# Получить все intents solver
near view verifier.testnet get_intents_by_user \
  '{"user_account":"your-solver.testnet"}' \
  --networkId testnet

# Отменить каждый вручную
for intent_id in $(cat stuck_intents.txt); do
  near call verifier.testnet cancel_intent \
    "{\"intent_id\":\"$intent_id\"}" \
    --accountId your-solver.testnet \
    --networkId testnet \
    --gas 100000000000000
done
```

---

## 📝 REPORTING BUGS

### При обнаружении бага:

1. **Собрать информацию:**
```bash
# Версия
cat package.json | grep version

# Environment
cat .env | grep -v PRIVATE_KEY

# Логи (последние 200 строк)
tail -200 logs/solver.log > bug-logs.txt

# Системная информация
node --version
pnpm --version
uname -a
```

2. **Воспроизвести:**
```bash
# Шаги для воспроизведения
# 1. ...
# 2. ...
# 3. ...
```

3. **Ожидаемое vs Актуальное:**
```
Expected: Intent should be executed
Actual: Transaction failed with error X
```

4. **Создать issue** в репозитории с этой информацией

---

## 💡 BEST PRACTICES

### Профилактика проблем:

1. **Регулярный мониторинг:**
```bash
# Cron job для проверки здоровья каждые 5 минут
*/5 * * * * /path/to/health-check.sh || /path/to/emergency-restart.sh
```

2. **Логирование:**
```bash
# Ротация логов
# В logrotate.conf:
/path/to/solver/logs/*.log {
  daily
  rotate 7
  compress
  missingok
  notifempty
}
```

3. **Alerts:**
```bash
# Telegram notification на ошибки
if grep -q "ERROR" logs/solver.log; then
  curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "text=🚨 Solver error detected"
fi
```

4. **Backup private key:**
```bash
# Зашифрованный backup
gpg --encrypt --recipient your@email.com .env
# Сохранить .env.gpg в безопасном месте
```

---

## 📞 SUPPORT

**Документация:**
- README.md
- DEPLOYMENT_GUIDE.md
- SOLVER_SYSTEM_EXPLAINED.md

**Логи:** `services/solver-node/logs/`

**Issues:** GitHub Issues

---

**Последнее обновление:** 2 ноября 2025

