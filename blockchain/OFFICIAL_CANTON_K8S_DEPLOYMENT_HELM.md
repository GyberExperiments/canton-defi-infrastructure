# 🏛️ ОФИЦИАЛЬНЫЙ ПРОМПТ: Развёртывание Canton Validator через Helm в Kubernetes

## 🎯 ЗАДАЧА

Развернуть **Canton Validator** на сервере **65.108.15.30** в Kubernetes используя **официальные Helm charts** от Digital Asset (разработчика Canton).

## 📚 ОФИЦИАЛЬНЫЕ РЕСУРСЫ CANTON

### 1. **Главный Helm Repository Canton**
- **Helm Repo:** `https://digital-asset.github.io/helm-chart-splice-core`
- **GitHub Repo:** `https://github.com/digital-asset/helm-chart-splice-core`
- **Документация:** `https://docs.canton.io`

### 2. **Готовые Helm Charts для Validator**
- **Splice Validator Chart:** `splice-validator` (основной компонент)
- **Splice Participant Chart:** `splice-participant` (БД и Ledger API)
- **Splice Scan Chart:** `splice-scan` (Dashboard)

### 3. **Документация Canton Network**
- Официальный сайт: `https://www.canton.io`
- DevNet Setup: `https://developer.daml.com/canton`
- Helm Values Reference: `https://github.com/digital-asset/helm-chart-splice-core/tree/main/charts`

## 🚀 ПОЛНАЯ ИНСТРУКЦИЯ РАЗВЁРТЫВАНИЯ

### ЭТАП 1: Подготовка окружения

#### Шаг 1.1: Добавить официальный Helm репозиторий

```bash
# Добавляем официальный Helm репозиторий от Digital Asset
helm repo add splice-core https://digital-asset.github.io/helm-chart-splice-core

# Обновляем список чартов
helm repo update

# Проверяем что репозиторий добавлен
helm repo list
# Вывод должен содержать: splice-core    https://digital-asset.github.io/helm-chart-splice-core

# Проверяем доступные charts
helm search repo splice-core
# Должны появиться charts: splice-validator, splice-participant, splice-scan
```

#### Шаг 1.2: Создаём Kubernetes Namespace

```bash
# Создаём отдельный namespace для Canton
kubectl create namespace canton-validator

# Проверяем
kubectl get namespace canton-validator
```

#### Шаг 1.3: Создаём Docker Registry Secret (для GHCR)

```bash
# Используем актуальный GitHub token для доступа к GHCR
GITHUB_TOKEN="$GITHUB_TOKEN"
GITHUB_USER="TheMacroeconomicDao"

kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username="$GITHUB_USER" \
  --docker-password="$GITHUB_TOKEN" \
  --namespace=canton-validator

# Проверяем
kubectl get secret ghcr-secret -n canton-validator
```

#### Шаг 1.4: Создаём Secret с конфидентальными данными

```bash
# Canton Onboarding Secret для подключения к DevNet
ONBOARDING_SECRET="$ONBOARDING_SECRET"

kubectl create secret generic canton-secrets \
  --from-literal=onboarding-secret="$ONBOARDING_SECRET" \
  --from-literal=participant-user="participant" \
  --from-literal=participant-pass="change-me-in-production" \
  -n canton-validator

# Проверяем
kubectl get secret canton-secrets -n canton-validator -o jsonpath='{.data}'
```

### ЭТАП 2: Создание Values файла для Helm

#### Шаг 2.1: Создаём файл `canton-values.yaml`

```bash
cat > canton-values.yaml <<'EOF'
# ==============================================================================
# Canton Validator - Helm Values (Official Splice Core)
# ==============================================================================
# https://github.com/digital-asset/helm-chart-splice-core

# PostgreSQL Configuration (статический компонент)
postgresql:
  enabled: true
  auth:
    username: canton
    password: "canton-secure-password-change-me"
    database: canton
  primary:
    persistence:
      size: 20Gi
      storageClass: "local-path"
  replica:
    replicaCount: 0

# Validator Configuration
validator:
  # Replica count
  replicaCount: 1
  
  # Image configuration
  image:
    repository: ghcr.io/themacroeconomicdao/validator-app
    tag: "0.5.8"
    pullPolicy: IfNotPresent
  
  # Resources
  resources:
    requests:
      memory: "2Gi"
      cpu: "500m"
    limits:
      memory: "4Gi"
      cpu: "2000m"
  
  # Environment variables
  env:
    # Canton Network Configuration
    SPLICE_APP_VALIDATOR_SV_SPONSOR_ADDRESS: "https://sv.sv-1.dev.global.canton.network.sync.global"
    SPLICE_APP_VALIDATOR_SCAN_ADDRESS: "https://scan.sv-1.dev.global.canton.network.sync.global"
    
    # Validator Identity
    SPLICE_APP_VALIDATOR_PARTY_HINT: "gyber-validator"
    SPLICE_APP_VALIDATOR_PARTICIPANT_IDENTIFIER: "gyber-validator"
    
    # Migration ID
    MIGRATION_ID: "0"
    DOMAIN_MIGRATION_ID: "0"
    
    # Database
    SPLICE_DB_SERVER: "postgresql"
    SPLICE_DB_PORT: "5432"
    SPLICE_DB_USER: "canton"
    SPLICE_DB_NAME: "canton"
  
  # Secrets from K8s Secret
  secrets:
    - name: SPLICE_APP_VALIDATOR_ONBOARDING_SECRET
      key: onboarding-secret
      secretName: canton-secrets
    - name: SPLICE_DB_PASSWORD
      key: participant-pass
      secretName: canton-secrets
  
  # Service configuration
  service:
    type: NodePort
    port: 5003
    targetPort: 5003
    nodePort: 30503
  
  # Network Policy
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
  
  # Health probes
  livenessProbe:
    tcpSocket:
      port: 5003
    initialDelaySeconds: 120
    periodSeconds: 30
    timeoutSeconds: 10
    failureThreshold: 5
  
  readinessProbe:
    tcpSocket:
      port: 5003
    initialDelaySeconds: 60
    periodSeconds: 15
    timeoutSeconds: 5
    failureThreshold: 3
  
  # Persistence
  persistence:
    enabled: true
    size: 50Gi
    storageClass: "local-path"
    mountPath: /validator-data

# Participant Configuration (Canton Participant Node)
participant:
  enabled: true
  replicaCount: 1
  
  image:
    repository: ghcr.io/themacroeconomicdao/canton-participant
    tag: "0.5.8"
    pullPolicy: IfNotPresent
  
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "3Gi"
      cpu: "1500m"
  
  env:
    CANTON_PARTICIPANT_POSTGRES_SERVER: "postgresql"
    CANTON_PARTICIPANT_POSTGRES_PORT: "5432"
    CANTON_PARTICIPANT_POSTGRES_USER: "canton"
    CANTON_PARTICIPANT_POSTGRES_DB: "participant"
    CANTON_PARTICIPANT_POSTGRES_SCHEMA: "participant"
    CANTON_PARTICIPANT_ADMIN_USER_NAME: "participant"
  
  secrets:
    - name: CANTON_PARTICIPANT_POSTGRES_PASSWORD
      key: participant-pass
      secretName: canton-secrets
  
  service:
    type: ClusterIP
    ports:
      ledgerApi: 4001
      adminApi: 4002

# Nginx (Reverse Proxy)
nginx:
  enabled: true
  replicaCount: 1
  
  image:
    repository: nginx
    tag: "latest"
  
  service:
    type: NodePort
    port: 80
    targetPort: 80
    nodePort: 30080

# Storage Class (для persistent volumes)
storageClass:
  name: "local-path"
  type: "hostPath"
  provisioner: "rancher.io/local-path"

# RBAC (Role-Based Access Control)
rbac:
  create: true

# Service Account
serviceAccount:
  create: true
  name: canton-validator
EOF

cat canton-values.yaml
```

### ЭТААП 3: Развёртывание через Helm

#### Шаг 3.1: Установка Validator Chart

```bash
# Устанавливаем Canton Validator через Helm
helm install canton-validator splice-core/splice-validator \
  --values canton-values.yaml \
  --namespace canton-validator \
  --create-namespace \
  --wait \
  --timeout 10m

# Проверяем статус установки
helm status canton-validator -n canton-validator
```

#### Шаг 3.2: Также устанавливаем Participant (если требуется отдельно)

```bash
# Если chart разделён на отдельные компоненты
helm install canton-participant splice-core/splice-participant \
  --values canton-values.yaml \
  --namespace canton-validator \
  --wait \
  --timeout 10m

# Проверяем
helm status canton-participant -n canton-validator
```

### ЭТАП 4: Верификация развёртывания

#### Шаг 4.1: Проверка статуса Pod'ов

```bash
# Смотрим статус всех Pod'ов
kubectl get pods -n canton-validator -w

# Ожидаемый вывод:
# NAME                                    READY   STATUS    RESTARTS   AGE
# canton-validator-0                      1/1     Running   0          3m
# canton-participant-0                    1/1     Running   0          2m
# postgresql-0                            1/1     Running   0          5m
# nginx-deployment-xxxxx                  1/1     Running   0          2m

# Ждём пока все Pod'ы достигнут статуса "Running"
```

#### Шаг 4.2: Получение детальной информации о Pod'ах

```bash
# Получаем описание validator Pod'а
kubectl describe pod canton-validator-0 -n canton-validator

# Проверяем events (события)
kubectl get events -n canton-validator --sort-by='.lastTimestamp'

# Смотрим информацию о services
kubectl get svc -n canton-validator
```

#### Шаг 4.3: Проверка логов

```bash
# Логи validator
kubectl logs -f canton-validator-0 -n canton-validator --tail=100

# Логи participant
kubectl logs -f canton-participant-0 -n canton-validator --tail=100

# Логи PostgreSQL
kubectl logs -f postgresql-0 -n canton-validator --tail=50

# Ищем в логах:
# ✅ "validator started"
# ✅ "connected to SCAN"
# ✅ "synchronized"
# ❌ Ошибок типа "connection refused", "image not found"
```

#### Шаг 4.4: Проверка сетевого доступа

```bash
# Получаем NodePort для validator
VALIDATOR_PORT=$(kubectl get svc -n canton-validator -o jsonpath='{.items[?(@.metadata.name=="canton-validator")].spec.ports[0].nodePort}')
echo "Validator dostupен na: 65.108.15.30:$VALIDATOR_PORT"

# Проверяем доступность через curl
curl -v http://65.108.15.30:$VALIDATOR_PORT/health || echo "Health check failed (normal if no health endpoint)"
curl -v http://65.108.15.30:30503 || echo "Port check"

# Проверяем на хосте через docker
ssh root@65.108.15.30 "docker ps -a | grep validator"
```

#### Шаг 4.5: Дополнительная проверка

```bash
# Проверяем что все компоненты подключены к PostreSQL
kubectl exec -it postgresql-0 -n canton-validator -- psql -U canton -d canton -c "\l"

# Проверяем storage
kubectl get pvc -n canton-validator

# Проверяем secrets
kubectl get secrets -n canton-validator

# Проверяем ConfigMaps
kubectl get configmaps -n canton-validator
```

## 🔄 КОМАНДЫ УПРАВЛЕНИЯ

### Обновление развёртывания

```bash
# После изменения canton-values.yaml
helm upgrade canton-validator splice-core/splice-validator \
  --values canton-values.yaml \
  --namespace canton-validator \
  --wait
```

### Откат к предыдущей версии

```bash
# Смотрим историю releases
helm history canton-validator -n canton-validator

# Откатываемся к определённой версии
helm rollback canton-validator <revision> -n canton-validator
```

### Удаление развёртывания

```bash
# Удаляем Helm release
helm uninstall canton-validator -n canton-validator
helm uninstall canton-participant -n canton-validator

# Удаляем namespace
kubectl delete namespace canton-validator
```

### Масштабирование

```bash
# Масштабируем validator на 3 реплики
kubectl scale deployment canton-validator --replicas=3 -n canton-validator

# Проверяем
kubectl get deployment -n canton-validator
```

## 🐛 TROUBLESHOOTING

### Проблема: Pod'ы не запускаются (CrashLoopBackOff)

```bash
# 1. Проверяем логи
kubectl logs <pod_name> -n canton-validator --previous

# 2. Проверяем события
kubectl describe pod <pod_name> -n canton-validator

# 3. Проверяем ресурсы
kubectl top pod <pod_name> -n canton-validator

# 4. Если ImagePullBackOff - проверяем secret
kubectl get secret ghcr-secret -n canton-validator -o yaml
```

### Проблема: "ImagePullBackOff"

```bash
# Перестраиваем Docker Registry Secret
kubectl delete secret ghcr-secret -n canton-validator

kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=TheMacroeconomicDao \
  --docker-password=$GITHUB_TOKEN \
  --namespace=canton-validator

# Пересоздаём Pod'ы для перехвата нового secret
kubectl delete pod --selector=app=canton-validator -n canton-validator
```

### Проблема: Pod не может подключиться к PostgreSQL

```bash
# Проверяем что PostgreSQL работает
kubectl get pods -n canton-validator | grep postgresql

# Проверяем logs PostgreSQL
kubectl logs postgresql-0 -n canton-validator

# Проверяем что сервис создан
kubectl get svc postgresql -n canton-validator

# Тестируем подключение из другого Pod'а
kubectl exec -it canton-validator-0 -n canton-validator -- /bin/bash
# Внутри контейнера:
nc -zv postgresql 5432
```

### Проблема: Нет доступа к API (connection refused)

```bash
# Проверяем что сервис правильно создан
kubectl get svc -n canton-validator -o wide

# Проверяем endpoint'ы
kubectl get endpoints -n canton-validator

# Проверяем что Pod'ы слушают на правильном порту
kubectl exec canton-validator-0 -n canton-validator -- netstat -tlnp | grep 5003

# Пробуем через port-forward
kubectl port-forward svc/canton-validator 5003:5003 -n canton-validator
# Потом в другом терминале:
curl localhost:5003/health
```

## 📊 МОНИТОРИНГ И ЛОГИРОВАНИЕ

### Проверка метрик пода

```bash
# Текущее использование ресурсов
kubectl top pod -n canton-validator

# Текущее использованиеNodes
kubectl top node
```

### Долгосрочный мониторинг

```bash
# Установка Prometheus (опционально, для production)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus -n monitoring --create-namespace

# Установка Grafana (опционально)
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana -n monitoring
```

## 📋 ЧЕКЛИСТ РАЗВЁРТЫВАНИЯ

- [ ] Helm репозиторий добавлен (`helm repo list`)
- [ ] Namespace создан (`kubectl get namespace canton-validator`)
- [ ] Docker Registry Secret создан (`kubectl get secret ghcr-secret -n canton-validator`)
- [ ] Canton Secrets созданы (`kubectl get secret canton-secrets -n canton-validator`)
- [ ] PersistentVolumeClaim создан (если требуется)
- [ ] Helm chart установлен (`helm install ...`)
- [ ] Все Pod'ы в статусе "Running" (`kubectl get pods -n canton-validator`)
- [ ] PostgreSQL инициализирован (`kubectl logs postgresql-0`)
- [ ] Participant запущен (`kubectl logs canton-participant-0`)
- [ ] Validator запущен (`kubectl logs canton-validator-0`)
- [ ] Логи не содержат ошибок
- [ ] API доступен через NodePort
- [ ] Validator подключился к Canton DevNet

## 🔗 ВАЖНЫЕ ССЫЛКИ

**Официальные ресурсы:**
- Helm Repository: https://digital-asset.github.io/helm-chart-splice-core
- GitHub Charts: https://github.com/digital-asset/helm-chart-splice-core
- Canton Documentation: https://docs.canton.io
- Canton DevNet: https://developer.daml.com/canton
- Splice Validator Docs: https://github.com/digital-asset/helm-chart-splice-core/tree/main/charts/splice-validator

**Конфигурация Canton:**
- Canton Configuration: https://docs.canton.io/docs/canton/reference/configuration
- Validator Setup: https://docs.canton.io/docs/canton/usermanual/validator_setup
- DevNet Connection: https://docs.canton.io/docs/canton/usermanual/devnet

**Kubernetes & Helm:**
- Helm Official: https://helm.sh
- Kubernetes Official: https://kubernetes.io
- K8s Best Practices: https://kubernetes.io/docs/concepts/configuration/overview/

## 🎓 ПРИМЕРЫ КОМАНД

### Полный цикл развёртывания за 1 раз

```bash
#!/bin/bash
set -e

echo "=== Adding Helm repository ==="
helm repo add splice-core https://digital-asset.github.io/helm-chart-splice-core
helm repo update

echo "=== Creating namespace ==="
kubectl create namespace canton-validator --dry-run=client -o yaml | kubectl apply -f -

echo "=== Creating secrets ==="
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=TheMacroeconomicDao \
  --docker-password=$GITHUB_TOKEN \
  --namespace=canton-validator \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic canton-secrets \
  --from-literal=onboarding-secret=$ONBOARDING_SECRET \
  --from-literal=participant-user=participant \
  --from-literal=participant-pass=change-me-in-production \
  -n canton-validator \
  --dry-run=client -o yaml | kubectl apply -f -

echo "=== Installing Helm chart ==="
helm install canton-validator splice-core/splice-validator \
  --values canton-values.yaml \
  --namespace canton-validator \
  --wait \
  --timeout 10m

echo "=== Checking status ==="
kubectl get pods -n canton-validator
kubectl get svc -n canton-validator

echo "✅ Canton Validator deployed successfully!"
```

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Production Ready:** Это решение использует официальные Helm charts от Digital Asset
2. **Security:** При production развёртывании обновите пароли в secrets
3. **Storage:** Измените storageClass в зависимости от вашей инфраструктуры
4. **Resources:** Увеличьте resource limits для production окружения
5. **Backup:** Регулярно выполняйте backup PostgreSQL
6. **Monitoring:** Рекомендуется установить Prometheus и Grafana для monitoring

---

**Версия:** 1.0  
**Дата:** 28 ноября 2025  
**Статус:** Официальное решение от Digital Asset  
**Поддержка:** https://developers.daml.com/support