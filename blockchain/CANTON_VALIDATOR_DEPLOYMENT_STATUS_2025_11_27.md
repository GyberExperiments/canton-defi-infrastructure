# 📊 ОТЧЕТ: Статус развертывания Canton Validator - 27 ноября 2025

## ✅ ВЫПОЛНЕННЫЕ РАБОТЫ

### 1. Диагностика проблемы ImagePullBackOff ✅
**Проблема:** Pod'ы не могли скачать образ из-за устаревших Docker Registry credentials (43 дня).

**Решение:**
```bash
# Получен новый GitHub token
gh auth token

# Удален старый секрет
kubectl delete secret ghcr-creds -n canton-node

# Создан новый секрет
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=TheMacroeconomicDao \
  --docker-password=$GITHUB_TOKEN \
  --namespace=canton-node
```

**Результат:** ✅ Образ успешно скачивается, ImagePullBackOff исправлен.

---

### 2. Очистка инфраструктуры ✅
```bash
# Удален старый Pod и StatefulSet
kubectl delete pod canton-node-0 -n canton-node
kubectl delete statefulset canton-node -n canton-node
```

---

### 3. Глубокий анализ архитектуры Canton ✅

**Обнаруженная архитектура:**

Образ `ghcr.io/themacroeconomicdao/canton-node:0.5.8` - это **НЕ самостоятельное приложение**!

Это **wrapper для Docker Compose**, который:
1. Выполняет скрипт `/opt/canton/start.sh`
2. Скрипт на строке 267 запускает: `docker compose -f compose.yaml up -d`
3. Docker Compose поднимает стек из 6 компонентов:
   - PostgreSQL
   - Canton Participant
   - Validator App
   - Wallet Web UI
   - ANS Web UI
   - Nginx

**Файлы внутри образа:**
```
/opt/canton/
├── compose.yaml                 # Главный compose файл
├── compose-*.yaml              # Дополнительные конфиги
├── start.sh                    # Скрипт запуска (вызывает docker compose)
├── stop.sh                     # Скрипт остановки
├── config/                     # Конфигурации Canton
├── data/                       # Директория для данных
└── logs/                       # Директория для логов
```

---

## 🔴 КРИТИЧЕСКАЯ ПРОБЛЕМА

**Суть проблемы:**
- Образ рассчитан на Docker Compose окружение
- В Kubernetes Pod'е команда `docker` недоступна
- Отдельные образы (`canton-participant:0.5.8`, `validator-app:0.5.8`) **НЕ доступны** в GHCR!
- Они используются только внутри `canton-node` образа через Docker Compose

**Текущий статус после попытки развертывания:**
```
NAME                                      READY   STATUS
pod/canton-participant-578cc5f894-b6qrd   0/1     ErrImagePull   # ❌ Образ не существует
pod/postgres-splice-0                     1/1     Running        # ✅ OK
pod/validator-app-678d78485f-5nv8l        0/1     Init:0/1       # ⏸️ Ждет Participant
```

---

## 📁 СОЗДАННЫЕ АРТЕФАКТЫ

### 1. [`blockchain/k8s/canton-validator-full-stack.yaml`](blockchain/k8s/canton-validator-full-stack.yaml)
Полная Kubernetes конфигурация с отдельными компонентами:
- ConfigMap с переменными окружения
- PostgreSQL StatefulSet + Service
- Canton Participant Deployment + Service
- Validator App Deployment + Service
- Health Check Service

**❌ НЕ РАБОТАЕТ** - отдельные образы недоступны в GHCR.

### 2. [`blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md`](blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md)
Детальный исследовательский промпт с анализом 6 вариантов решения проблемы.

---

## 🎯 ВАРИАНТЫ РЕШЕНИЯ (из исследовательского промпта)

### Вариант 1: Docker-in-Docker (DinD) ⭐ РЕКОМЕНДУЕТСЯ ИССЛЕДОВАТЬ ПЕРВЫМ
Запуск Docker daemon внутри Kubernetes Pod для выполнения Docker Compose.

**Pros:**
- Использует существующий образ `canton-node:0.5.8`
- Не требует изменения архитектуры
- Работает "как есть"

**Cons:**
- Требует privileged container (security risk)
- Сложность в production
- Performance overhead

**Пример подхода:**
```yaml
spec:
  containers:
  - name: dind
    image: docker:dind
    securityContext:
      privileged: true
  - name: canton-node
    image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
    env:
    - name: DOCKER_HOST
      value: tcp://localhost:2375
```

### Вариант 2: Использование host Docker socket
Монтирование `/var/run/docker.sock` с хоста в Pod.

**Pros:**
- Простая реализация
- Используется в CI/CD пайплайнах

**Cons:**
- Высокий security risk
- Контейнеры создаются на хосте, а не в Pod

### Вариант 3: Запуск напрямую на хосте через systemd
Запустить Docker Compose напрямую на сервере 65.108.15.30 вне Kubernetes.

**Pros:**
- Самое простое решение
- Работает гарантированно
- Нативное использование образа

**Cons:**
- Теряются преимущества Kubernetes (scaling, self-healing)
- Усложняется мониторинг

### Вариант 4: Поиск официальных Canton Helm charts
Возможно существуют готовые решения от Digital Asset.

### Вариант 5: Конвертация через Kompose
Извлечь `compose.yaml` и конвертировать в K8s манифесты.

### Вариант 6: KubeVirt (nested virtualization)
Запуск VM в Kubernetes - излишняя сложность.

---

## 🚀 РЕКОМЕНДУЕМЫЙ ПЛАН ДЕЙСТВИЙ

### Шаг 1: Глубокое исследование (1-2 часа)
Использовать промпт из [`blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md`](blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md) в новом чате.

**Цель:** Найти production-ready решение с минимальным security risk.

### Шаг 2: Быстрое временное решение (если нужно срочно)
Запустить Canton Validator напрямую на хосте через Docker Compose:

```bash
# На сервере 65.108.15.30
ssh root@65.108.15.30

# Создать директорию
mkdir -p /opt/canton-validator && cd /opt/canton-validator

# Запустить через Docker
docker run -d \
  --name canton-validator \
  --restart unless-stopped \
  --network host \
  -e SPONSOR_SV_ADDRESS="https://sv.sv-1.dev.global.canton.network.sync.global" \
  -e ONBOARDING_SECRET="$ONBOARDING_SECRET" \
  -e PARTY_HINT="gyber-validator" \
  -e MIGRATION_ID="0" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/canton-validator/data:/opt/canton/data \
  -v /opt/canton-validator/logs:/opt/canton/logs \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  /opt/canton/start.sh \
    -s https://sv.sv-1.dev.global.canton.network.sync.global \
    -o $ONBOARDING_SECRET \
    -p gyber-validator \
    -m 0
```

### Шаг 3: Production решение (после исследования)
Реализовать выбранный вариант из исследования с полным тестированием.

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ РЕСУРСОВ

### Kubernetes Resources
```
NAMESPACE: canton-node

Secrets:
✅ ghcr-creds              - Docker Registry credentials (ОБНОВЛЕН)
✅ canton-onboarding       - Onboarding secret (валиден для DevNet)

Running Pods:
✅ postgres-splice-0       - PostgreSQL 14 (Ready)
❌ canton-participant      - ErrImagePull (образ не существует)
⏸️ validator-app           - Init:0/1 (ждет Participant)

Services:
✅ postgres-splice         - ClusterIP None
✅ participant             - ClusterIP
✅ validator               - NodePort 30503/30504
✅ canton-validator-health - LoadBalancer на 65.108.15.30:8081
```

### Server
```
IP: 65.108.15.30
Hostname: canton-node-65-108-15-30
K3s: Running
Docker: Available on host
```

---

## 🔐 SENSITIVE DATA (НЕ ДЕЛИТЬСЯ!)

**GitHub Token (срок действия: ~30 дней):**
```
$GITHUB_TOKEN
```

**Canton Onboarding Secret (DevNet):**
```
$ONBOARDING_SECRET
```

**Renewal reminder:** Обновить credentials через ~25 дней (до 22 декабря 2025).

---

## 📝 LESSONS LEARNED

1. **Не все Docker образы подходят для Kubernetes** - некоторые рассчитаны только на Docker Compose
2. **Важно проверять архитектуру образа** перед развертыванием в K8s
3. **Docker-in-Docker в production требует тщательной оценки** security implications
4. **Иногда простое решение (systemd на хосте) лучше сложного** (K8s с DinD)

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

1. ✅ **СЕГОДНЯ:** Использовать исследовательский промпт для поиска решения
2. ⏳ **ПОСЛЕ ИССЛЕДОВАНИЯ:** Выбрать и реализовать оптимальный вариант
3. ⏳ **ВАЛИДАЦИЯ:** Проверить connectivity к SCAN API после запуска
4. ⏳ **МОНИТОРИНГ:** Настроить health checks и alerting

---

**Дата:** 27 ноября 2025, 23:02 MSK
**Статус:** 🟡 В процессе - требуется дальнейшее исследование
**Следующий этап:** Глубокое исследование вариантов запуска Docker Compose в K8s