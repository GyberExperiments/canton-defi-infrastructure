# 🚀 Canton OTC - Полная инструкция по деплою

**Проект**: Canton OTC Exchange  
**Репозиторий**: https://github.com/TheMacroeconomicDao/CantonOTC  
**Production**: https://1otc.cc  
**Последнее обновление**: 28 октября 2025

---

## 📋 БЫСТРЫЙ СТАРТ (для AI ассистента в новом чате)

```bash
# 1. Переход в проект
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 2. Проверка текущей ветки (работаем в MAIN)
git checkout main
git pull origin main

# 3. Сборка образа (только с хешем коммита)
COMMIT_HASH=$(git rev-parse --short HEAD)
docker build \
  -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -f Dockerfile .

# 4. Push в registry
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH

# 5. Deploy в Kubernetes (обновить образ на хеш коммита)
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s

# 6. Проверка
kubectl get pods -n canton-otc -l app=canton-otc
```

---

## 🏗️ АРХИТЕКТУРА ПРОЕКТА

### Основные компоненты:
- **Frontend**: Next.js 15.5.6 (App Router)
- **Backend**: Next.js API Routes
- **Database**: Google Sheets (основное хранилище)
- **Cache**: Redis (не критичен)
- **Notifications**: Telegram Bot + Intercom
- **Infrastructure**: Kubernetes на production

### Окружения:
1. **Main** (production) - namespace: `canton-otc`
   - URL: https://1otc.cc
   - Image tag: хеш коммита (например: `c0bf7235`)
   
2. **Stage** (testing) - namespace: `canton-otc-stage`
   - URL: https://stage.1otc.cc (если есть)
   - Image tag: `stage`

---

## 🔧 ПОДГОТОВКА К ДЕПЛОЮ

### 1. Проверка окружения

```bash
# Kubernetes доступен?
kubectl cluster-info

# Docker запущен?
docker info

# Правильная ветка?
git branch --show-current  # Должно быть: main

# Есть ли незакоммиченные изменения?
git status
```

### 2. Проверка конфигурации

```bash
# ConfigMap с ценами
kubectl get configmap -n canton-otc canton-otc-config -o jsonpath='{.data}' | jq .

# Должны быть:
# CANTON_COIN_BUY_PRICE_USD: "0.44"
# CANTON_COIN_SELL_PRICE_USD: "0.12"

# Env переменные в deployment
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name | contains("CANTON"))'
```

---

## 📦 СБОРКА ОБРАЗА

### Стандартная сборка (с кешем, только с хешем коммита):

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

COMMIT_HASH=$(git rev-parse --short HEAD)
docker build \
  -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -f Dockerfile .
```

**Время**: ~5-7 минут  
**Размер**: ~312 MB

### Сборка без кеша (если проблемы):

```bash
COMMIT_HASH=$(git rev-parse --short HEAD)
docker build --no-cache \
  -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -f Dockerfile .
```

**Время**: ~8-10 минут

### Проверка успешной сборки:

```bash
# Проверить что образ создался
docker images | grep cantonotc | head -3

# Должны увидеть:
# ghcr.io/themacroeconomicdao/cantonotc   main    XXXXX   N seconds/minutes ago   312MB
```

---

## 📤 PUSH В REGISTRY

### Логин в GitHub Container Registry (если нужно):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u TheMacroeconomicDao --password-stdin
```

### Push образа:

```bash
COMMIT_HASH=$(git rev-parse --short HEAD)
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH
```

**Время**: ~2-3 минуты

---

## 🚀 DEPLOYMENT В KUBERNETES

### Production (main namespace):

```bash
# Получить хеш текущего коммита
COMMIT_HASH=$(git rev-parse --short HEAD)

# Обновить образ deployment на хеш коммита
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -n canton-otc

# Дождаться завершения
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s

# Проверить поды
kubectl get pods -n canton-otc -l app=canton-otc

# Должно быть: 2/2 Running
```

### Проверка используемого образа:

```bash
kubectl describe deployment canton-otc -n canton-otc | grep "Image:"

# Должно быть: ghcr.io/themacroeconomicdao/cantonotc:<COMMIT_HASH>
```

### Если нужно обновить env переменные:

```bash
# Добавить/обновить env
kubectl set env deployment/canton-otc -n canton-otc \
  CANTON_COIN_BUY_PRICE_USD=0.44 \
  CANTON_COIN_SELL_PRICE_USD=0.12

# Deployment перезапустится автоматически
```

---

## 🧪 ТЕСТИРОВАНИЕ ПОСЛЕ ДЕПЛОЯ

### 1. Проверка health

```bash
curl -I https://1otc.cc

# Должно быть: HTTP/2 200
```

### 2. Тест Canton HEX::HEX валидации

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 700,
    "cantonAmount": 1591,
    "email": "test@example.com",
    "exchangeDirection": "buy"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Ожидаемый результат**:
```json
{
  "success": true,
  "orderId": "MH9...",
  "validation": {
    "cantonAddress": "Canton Network HEX::HEX format",
    "addressValid": true
  }
}
HTTP Status: 200
```

### 3. Тест SELL direction

```bash
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "cantonAmount": 10000,
    "paymentAmount": 1206,
    "paymentAmountUSD": 1206,
    "usdtAmount": 1206,
    "email": "test-sell@example.com",
    "exchangeDirection": "sell"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### Проверка логов:

```bash
# Последние 50 строк
kubectl logs -n canton-otc deployment/canton-otc --tail=50

# Следить за логами в реальном времени
kubectl logs -n canton-otc deployment/canton-otc -f

# Ошибки валидации
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i "error\|validation\|failed"
```

### Проверка статуса подов:

```bash
# Статус подов
kubectl get pods -n canton-otc

# Детали пода
kubectl describe pod -n canton-otc -l app=canton-otc

# События
kubectl get events -n canton-otc --sort-by='.lastTimestamp' | tail -20
```

### Если поды не запускаются:

```bash
# Проверить причину
kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[*].status.containerStatuses[*].state}'

# Логи crashed пода
kubectl logs -n canton-otc -l app=canton-otc --previous
```

---

## 🛠️ ЧАСТЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: Build провалился

**Симптомы**: TypeScript errors, module not found

**Решение**:
```bash
# Проверить что удалены проблемные файлы
ls -la src/lib/services/ | grep -E "addressGenerator|persistentStorage|supabase"

# Их НЕ должно быть! Если есть - удалить:
rm -f src/lib/services/addressGenerator.ts
rm -f src/lib/services/persistentStorage.ts  
rm -f src/lib/services/supabase.ts

git add -A
git commit -m "fix: Remove problematic services"
git push origin main
```

### Проблема 2: "Invalid exchange rate calculation"

**Причина**: Несоответствие цен frontend ↔ backend

**Решение**:
```bash
# 1. Проверить ConfigMap
kubectl get configmap -n canton-otc canton-otc-config -o jsonpath='{.data.CANTON_COIN_BUY_PRICE_USD}'

# 2. Обновить если неправильно
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{"data":{"CANTON_COIN_BUY_PRICE_USD":"0.44","CANTON_COIN_SELL_PRICE_USD":"0.12"}}'

# 3. Перезапустить поды
kubectl rollout restart deployment/canton-otc -n canton-otc
```

### Проблема 3: Docker не запускается

**Решение**:
```bash
# Перезапустить Docker Desktop
killall Docker
sleep 3
open -a Docker

# Подождать 30-60 секунд
sleep 60

# Проверить готовность
docker info
```

### Проблема 4: "ImagePullBackOff" в Kubernetes

**Решение**:
```bash
# Проверить что образ существует в registry
docker manifest inspect ghcr.io/themacroeconomicdao/cantonotc:main

# Проверить imagePullSecrets
kubectl get secret -n canton-otc ghcr-secret

# Пересоздать если нужно (попросить токен у пользователя)
```

---

## 📊 ПРОВЕРКА КОНФИГУРАЦИИ

### Критичные env переменные:

```bash
kubectl get deployment canton-otc -n canton-otc -o yaml | grep -A 2 "CANTON_COIN"
```



### ConfigMap значения:

```bash
kubectl get configmap -n canton-otc canton-otc-config -o jsonpath='{.data}' | jq -r 'to_entries[] | select(.key | contains("PRICE")) | "\(.key)=\(.value)"'
```

---

## 🔄 ПОЛНЫЙ ЦИКЛ ДЕПЛОЯ (copy-paste ready)

```bash
#!/bin/bash
set -e

echo "🚀 Canton OTC - Полный деплой в production (main)"
echo ""

# 1. Переход в проект
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
echo "✅ В директории проекта"

# 2. Переключение на main и pull
git checkout main
git pull origin main
echo "✅ Main ветка обновлена"

# 3. Проверка Docker
docker info >/dev/null 2>&1 || { echo "❌ Docker не запущен!"; exit 1; }
echo "✅ Docker работает"

# 4. Сборка образа (только с хешем коммита)
echo "🔨 Собираю образ (5-7 минут)..."
COMMIT_HASH=$(git rev-parse --short HEAD)
echo "📦 Коммит: $COMMIT_HASH"
docker build \
  -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -f Dockerfile .

echo "✅ Образ собран"

# 5. Push в registry
echo "📤 Пушу в registry..."
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH
echo "✅ Образ запушен"

# 6. Deploy в Kubernetes
echo "🚀 Деплою в Kubernetes..."
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH \
  -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s
echo "✅ Deployment завершен"

# 7. Проверка статуса
echo ""
echo "📊 Статус подов:"
kubectl get pods -n canton-otc -l app=canton-otc

echo ""
echo "📦 Используемый образ:"
kubectl describe deployment canton-otc -n canton-otc | grep "Image:"

echo ""
echo "🧪 Тест API:"
curl -X POST https://1otc.cc/api/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "cantonAddress": "04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "refundAddress": "bron::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8",
    "usdtAmount": 700,
    "cantonAmount": 1591,
    "email": "test@example.com",
    "exchangeDirection": "buy"
  }' \
  -s -w "\nHTTP Status: %{http_code}\n" | jq .

echo ""
echo "🎉 Деплой завершен успешно!"
```

---

## 📝 ЧТО НУЖНО ЗНАТЬ О ПРОЕКТЕ

### Критичные файлы:

1. **src/config/otc.ts** - конфигурация цен и лимитов
   - `getCantonCoinBuyPriceSync()` - ВСЕГДА должна возвращать значение из env или 0.44
   - `getCantonCoinSellPriceSync()` - ВСЕГДА должна возвращать значение из env или 0.12

2. **src/lib/validators.ts** - валидация Canton адресов
   - Поддерживает 4 формата (HEX::HEX - самый распространенный)

3. **src/app/api/create-order/route.ts** - создание ордеров
   - Раздельная валидация для buy/sell
   - Обязательно использует exchangeDirection

4. **src/components/OrderSummary.tsx** - UI ордера
   - Polling статуса каждые 5 сек (если в feature ветке)

### Удаленные файлы (НЕ восстанавливать!):
- ❌ src/lib/services/addressGenerator.ts
- ❌ src/lib/services/persistentStorage.ts
- ❌ src/lib/services/supabase.ts

Эти файлы вызывали build errors (BIP32Interface, TronWebInstance, @supabase/supabase-js).

---

## 🔐 СЕКРЕТЫ И ПЕРЕМЕННЫЕ

### Env переменные (обязательные):

```bash
# В Kubernetes deployment (уже настроены):
- CANTON_COIN_BUY_PRICE_USD=0.44
- CANTON_COIN_SELL_PRICE_USD=0.12
- NODE_ENV=production
- NEXT_PUBLIC_APP_URL=https://1otc.cc

# В ConfigMap (canton-otc-config):
- MIN_USDT_AMOUNT=700
- MIN_CANTON_AMOUNT=4
- BUSINESS_HOURS=8:00 AM - 10:00 PM (GMT+8)
- SUPPORT_EMAIL=support@1otc.cc
```

### Секреты (НЕ коммитить!):

```bash
# Google Sheets
- GOOGLE_SHEET_ID
- GOOGLE_CREDENTIALS (JSON)

# Telegram
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

# Intercom
- NEXT_PUBLIC_INTERCOM_APP_ID
- INTERCOM_ACCESS_TOKEN
```

---

## 📋 CHECKLIST ПЕРЕД ДЕПЛОЕМ

- [ ] Git: main ветка, pull завершен
- [ ] Docker: запущен и отвечает
- [ ] Линтер: нет критичных ошибок
- [ ] Build: образ собрался успешно
- [ ] Push: образ в registry
- [ ] ConfigMap: цены правильные (0.44/0.12)
- [ ] Deployment: pods 2/2 Running
- [ ] Test API: HTTP 200 для buy и sell

---

## 🆘 ROLLBACK (если что-то пошло не так)

### Откат к предыдущей версии:

```bash
# 1. Найти предыдущий рабочий коммит
git log --oneline -10

# 2. Откатить main
git reset --hard <PREVIOUS_COMMIT_HASH>
git push origin main --force

# 3. Пересобрать и задеплоить
COMMIT_HASH=$(git rev-parse --short HEAD)
docker build -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -f Dockerfile .
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH
kubectl set image deployment/canton-otc canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -n canton-otc
```

### Откат deployment без изменения кода:

```bash
# Использовать старый образ
kubectl set image deployment/canton-otc \
  canton-otc=ghcr.io/themacroeconomicdao/cantonotc:<OLD_TAG> \
  -n canton-otc
```

---

## 📚 ДОКУМЕНТАЦИЯ

- `README.md` - общее описание проекта
- `TELEGRAM_STATUS_FEATURE.md` - Telegram status control
- `SECURITY_CVE_ANALYSIS.md` - анализ уязвимостей
- `FINAL_SUMMARY_ALL_FIXES.md` - все исправления
- `SELL_DIRECTION_FIX.md` - fix для sell direction

---

## 💡 ВАЖНЫЕ КОМАНДЫ

```bash
# Быстрая пересборка и деплой
COMMIT_HASH=$(git rev-parse --short HEAD) && \
docker build -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -f Dockerfile . && \
docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH && \
kubectl set image deployment/canton-otc canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -n canton-otc

# Посмотреть логи ошибок
kubectl logs -n canton-otc deployment/canton-otc --tail=100 | grep -i error

# Проверить env в работающем поде
kubectl exec -n canton-otc deployment/canton-otc -- env | grep CANTON

# Обновить ConfigMap и перезапустить
kubectl patch configmap canton-otc-config -n canton-otc --type merge -p '{"data":{"CANTON_COIN_BUY_PRICE_USD":"0.44"}}' && \
kubectl rollout restart deployment/canton-otc -n canton-otc
```

---

## 🎯 ДЛЯ AI АССИСТЕНТА

**Когда пользователь просит "собери и задеплой":**

1. `cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc`
2. `git checkout main && git pull origin main`
3. `COMMIT_HASH=$(git rev-parse --short HEAD)`
4. `docker build -t ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -f Dockerfile .`
5. `docker push ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH`
6. `kubectl set image deployment/canton-otc canton-otc=ghcr.io/themacroeconomicdao/cantonotc:$COMMIT_HASH -n canton-otc`
7. `kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s`
8. Протестировать через curl

**НЕ запускать build в фоне** - пользователь хочет видеть вывод!

**Помнить**:
- Работаем в **main** ветке (не stage, не minimal-stage)
- Namespace: **canton-otc** (production)
- URL: **https://1otc.cc**
- Цены: **0.44** (buy) / **0.12** (sell) - из ConfigMap
- Canton validation: поддержка **HEX::HEX** формата (04286df6...)

---

**Автор**: AI Assistant  
**Дата**: 28 октября 2025  
**Версия**: 1.0

