# 📊 Статус настройки Canton Validator Node

**Дата**: 2025-11-12  
**Нода**: 65.108.15.30 (Devnet)

## ✅ Что я сделал автоматически:

### 1. Установка Ubuntu на сервер
- ✅ Установлен Ubuntu 24.04.3 LTS на сервер 65.108.15.30
- ✅ Hostname установлен: `canton-node-65-108-15-30`
- ✅ Сервер перезагружен и работает

### 2. Подключение к k3s кластеру
- ✅ Нода успешно подключена к кластеру
- ✅ Hostname: `canton-node-65-108-15-30`
- ✅ IP: `65.108.15.30`
- ✅ Статус: Ready
- ✅ Версия k3s: v1.31.5+k3s1

### 3. Развертывание валидатора
- ✅ Манифест обновлен с правильным hostname
- ✅ StatefulSet создан: `canton-node-new`
- ✅ Под развернут на ноде `canton-node-65-108-15-30`

### 4. Исправление Dockerfile
- ✅ Добавлен `jq` в Dockerfile для validator-image
- ⚠️ **Требуется пересборка образа** (см. ниже)

## ❌ Что я НЕ могу сделать (требуется ваше действие):

### 1. Пересобрать Docker образ с исправлением jq

**Проблема**: Образ `ghcr.io/themacroeconomicdao/canton-node:0.5.8` не содержит `jq`, из-за чего контейнер падает.

**Что нужно сделать**:
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/blockchain/validator-image

# Пересобрать образ
docker build -t ghcr.io/themacroeconomicdao/canton-node:0.5.8 .

# Или с тегом для тестирования
docker build -t ghcr.io/themacroeconomicdao/canton-node:0.5.8-fixed .

# Запушить в registry (если есть доступ)
docker push ghcr.io/themacroeconomicdao/canton-node:0.5.8
```

**Альтернатива**: Если нет доступа к registry, можно использовать initContainer для установки jq:
```yaml
initContainers:
- name: install-jq
  image: busybox
  command: ['sh', '-c', 'apk add --no-cache jq']
```

### 2. Получить реальный Onboarding Secret для Devnet

**Проблема**: Secret содержит placeholder `CHANGE_ME`, нужен реальный secret.

**Что нужно сделать**:
1. Убедитесь, что IP 65.108.15.30 добавлен в whitelist для Devnet (уже запрошено у GSF)
2. После подтверждения whitelisting получите secret:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/blockchain/scripts
./get-onboarding-secret.sh devnet --save
```

3. Обновите Secret в Kubernetes:
```bash
# Получите secret из файла
SECRET=$(grep DEVNET_ONBOARDING_SECRET blockchain/config/onboarding-secrets.env | cut -d'=' -f2)

# Обновите Secret
kubectl create secret generic canton-onboarding \
    -n canton-node \
    --from-literal=ONBOARDING_SECRET="$SECRET" \
    --dry-run=client -o yaml | kubectl apply -f -

# Перезапустите под
kubectl delete pod -n canton-node canton-node-new-0
```

### 3. Проверить whitelisting

**Что нужно сделать**:
После того как валидатор запустится, проверьте логи на ошибки whitelisting:

```bash
kubectl logs -n canton-node canton-node-new-0 | grep -i "whitelist\|unauthorized\|forbidden\|403\|401"
```

**Признаки успешного whitelisting**:
- ✅ Нет ошибок "IP not whitelisted"
- ✅ Нет ошибок "403 Forbidden" или "401 Unauthorized"
- ✅ Логи показывают успешное подключение к Devnet

**Признаки проблем с whitelisting**:
- ❌ Ошибки "IP not whitelisted"
- ❌ Ошибки "403 Forbidden" или "401 Unauthorized"
- ❌ Невозможность подключиться к Devnet API

## 📋 Текущий статус компонентов:

| Компонент | Статус | Детали |
|-----------|--------|--------|
| Сервер 65.108.15.30 | ✅ Работает | Ubuntu 24.04.3 LTS |
| k3s нода | ✅ Подключена | Ready, v1.31.5+k3s1 |
| StatefulSet | ✅ Создан | canton-node-new |
| Под | ⚠️ CrashLoopBackOff | Ошибка: jq не найден |
| Dockerfile | ✅ Исправлен | jq добавлен (требуется пересборка) |
| Onboarding Secret | ❌ Placeholder | Требуется реальный secret |
| Whitelisting | ⏳ Ожидание | Запрос отправлен GSF |

## 🚀 Следующие шаги (в порядке приоритета):

1. **Пересобрать Docker образ** с исправленным Dockerfile (добавлен jq)
2. **Получить реальный onboarding secret** после подтверждения whitelisting
3. **Обновить Secret** в Kubernetes
4. **Перезапустить под** и проверить работу
5. **Проверить whitelisting** через логи

## 📝 Полезные команды:

```bash
# Проверка статуса ноды
kubectl get nodes -o wide | grep 65.108.15.30

# Проверка статуса валидатора
kubectl get pods -n canton-node -l node=new-validator

# Логи валидатора
kubectl logs -n canton-node canton-node-new-0

# Проверка whitelisting в логах
kubectl logs -n canton-node canton-node-new-0 | grep -i "whitelist\|unauthorized\|forbidden"

# Health check (после запуска)
curl http://65.108.15.30:8081/health

# Описание пода (для диагностики)
kubectl describe pod -n canton-node canton-node-new-0
```

---

**Информация о whitelisting**:
- Devnet IP: 65.108.15.30 ✅ (запрошено)
- Testnet IP: 65.108.15.20 ✅ (запрошено)
- Mainnet IP: 65.108.15.19 ✅ (запрошено)
- Sponsor: GSF
- Organization: TECH HY

















