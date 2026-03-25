# Production-Ready План Безопасности Kubernetes Кластера

## Анализ Best Practices vs Текущее Решение

### ✅ Что уже есть (базовый уровень)

1. **Статическое сканирование узлов:**
   - ClamAV - антивирус
   - rkhunter - поиск руткитов
   - chkrootkit - проверка на руткиты
   - Lynis - аудит безопасности

2. **Базовая проверка кластера:**
   - Проверка процессов в подах
   - Проверка Jobs и CronJobs
   - Проверка ConfigMaps и Secrets
   - Проверка сетевых соединений

### ⚠️ Что отсутствует для Production (критично)

1. **Runtime Security Monitoring** - отсутствует
2. **Image Scanning в CI/CD** - отсутствует
3. **Kubernetes Audit Logs** - не настроены
4. **Network Policies Monitoring** - отсутствует
5. **Process Safelisting** - отсутствует
6. **Централизованное логирование** - отсутствует

---

## Production-Ready Решение

### 1. Runtime Security Monitoring - Falco (КРИТИЧНО)

Falco - industry standard для runtime security в Kubernetes. Мониторит системные вызовы в реальном времени.

#### Установка Falco через Helm:
```bash
# Добавить репозиторий
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

# Установить Falco
helm install falco falcosecurity/falco \
  --namespace falco-system \
  --create-namespace \
  --set driver.enabled=true \
  --set falco.grpc.enabled=true \
  --set falco.grpcOutput.enabled=true
```

#### Кастомные правила Falco для обнаружения майнеров:
```yaml
# falco-rules-custom.yaml
- rule: Detect Cryptocurrency Mining
  desc: Detect cryptocurrency mining activity
  condition: >
    spawned_process and
    (proc.name in (javae, XFZSrI, miner, xmrig, cpuminer, ccminer) or
     proc.cmdline contains "mining" or
     proc.cmdline contains "cryptocurrency" or
     proc.cmdline contains "pool" or
     proc.cmdline contains "stratum")
  output: >
    Cryptocurrency mining detected
    (user=%user.name command=%proc.cmdline
    container_id=%container.id container_name=%container.name
    image=%container.image.repository)
  priority: CRITICAL
  tags: [container, process, mining]

- rule: Unauthorized Process in Container
  desc: Detect unauthorized processes in containers
  condition: >
    spawned_process and
    container and
    not proc.name in (node, java, python, nginx, envoy, postgres, redis)
  output: >
    Unauthorized process started in container
    (user=%user.name command=%proc.cmdline
    container_id=%container.id container_name=%container.name
    image=%container.image.repository)
  priority: WARNING
  tags: [container, process]

- rule: Shell Spawned in Container
  desc: Detect shell spawned in container
  condition: >
    spawned_process and
    container and
    proc.name in (sh, bash, zsh, ash)
  output: >
    Shell spawned in container
    (user=%user.name command=%proc.cmdline
    container_id=%container.id container_name=%container.name
    image=%container.image.repository)
  priority: NOTICE
  tags: [container, shell]
```

#### Интеграция с Kubernetes:
```yaml
# falco-sidekick-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: falco-sidekick
  namespace: falco-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: falco-sidekick
  template:
    metadata:
      labels:
        app: falco-sidekick
    spec:
      containers:
      - name: falco-sidekick
        image: falcosecurity/falco-sidekick:latest
        env:
        - name: WEBHOOK_URL
          value: "http://alertmanager:9093/api/v1/alerts"
```

### 2. Image Scanning - Trivy (КРИТИЧНО)

Trivy - сканирование образов на уязвимости и вредоносное ПО перед деплоем.

#### Установка Trivy Operator:
```bash
# Установка через Helm
helm repo add aquasecurity https://aquasecurity.github.io/helm-charts/
helm repo update
helm install trivy-operator aquasecurity/trivy-operator \
  --namespace trivy-system \
  --create-namespace \
  --set trivy.ignoreUnfixed=true
```

#### Автоматическое сканирование всех образов:
```yaml
# trivy-autoscan.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: trivy-operator-config
  namespace: trivy-system
data:
  trivy.ignoreUnfixed: "true"
  trivy.severity: "CRITICAL,HIGH"
  trivy.scanJobTimeout: "10m"
```

#### Интеграция в CI/CD:
```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  push:
    branches: [main]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'ghcr.io/themacroeconomicdao/cantonotc:latest'
        format: 'sarif'
        output: 'trivy-results.sarif'
```

### 3. Kubernetes Audit Logs (КРИТИЧНО)

Включение audit logging для отслеживания всех API запросов.

#### Настройка Audit Policy:
```yaml
# audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  namespaces: ["default"]
- level: RequestResponse
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["pods", "deployments", "services", "secrets"]
- level: Request
  verbs: ["get", "list", "watch"]
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
```

#### Настройка в k3s:
```bash
# /etc/rancher/k3s/config.yaml
apiVersion: v1
kind: Config
audit-policy-file: /etc/rancher/k3s/audit-policy.yaml
```

### 4. Network Policies Monitoring

Мониторинг сетевого трафика и применение Network Policies.

#### Пример Network Policy:
```yaml
# network-policy-example.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-egress
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: TCP
      port: 53
  - to:
    - namespaceSelector:
        matchLabels:
          name: default
```

#### Мониторинг сетевого трафика:
```bash
# Установка Cilium для advanced network policies
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set prometheus.enabled=true \
  --set operator.prometheus.enabled=true
```

### 5. Process Safelisting

Создание whitelist разрешённых процессов для каждого namespace.

#### Pod Security Policy:
```yaml
# pod-security-policy.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
```

### 6. Централизованное Логирование

Настройка централизованного сбора логов для анализа.

#### Установка Loki + Promtail:
```bash
# Loki для хранения логов
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --create-namespace \
  --set promtail.enabled=true
```

#### Сбор логов Falco:
```yaml
# promtail-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: falco
    static_configs:
      - targets:
          - localhost
        labels:
          job: falco
          __path__: /var/log/falco.log
```

---

## Приоритизация Внедрения

### Фаза 1: Немедленно (критично для production)

1. **Falco** - runtime security monitoring
   - Время установки: 30 минут
   - Сложность: Средняя
   - Критичность: ВЫСОКАЯ

2. **Trivy** - сканирование образов
   - Время установки: 20 минут
   - Сложность: Низкая
   - Критичность: ВЫСОКАЯ

3. **Kubernetes Audit Logs**
   - Время настройки: 15 минут
   - Сложность: Низкая
   - Критичность: ВЫСОКАЯ

### Фаза 2: В течение недели

4. **Network Policies**
   - Время настройки: 2-4 часа
   - Сложность: Средняя
   - Критичность: СРЕДНЯЯ

5. **Process Safelisting (Pod Security Policies)**
   - Время настройки: 1-2 часа
   - Сложность: Средняя
   - Критичность: СРЕДНЯЯ

### Фаза 3: В течение месяца

6. **Централизованное Логирование (Loki)**
   - Время настройки: 2-3 часа
   - Сложность: Средняя
   - Критичность: НИЗКАЯ

---

## Комплексный Скрипт Установки

Создать скрипт для автоматической установки всех компонентов.

## Мониторинг и Алерты

Настроить алерты на:
- Обнаружение майнеров
- Неавторизованные процессы
- Подозрительная сетевая активность
- Критические уязвимости в образах
- Несанкционированный доступ к API

## Регулярные Проверки

1. **Ежедневно:** Falco alerts review
2. **Еженедельно:** Trivy scan всех образов
3. **Ежемесячно:** Полный security audit
4. **Ежеквартально:** Penetration testing

---

## Сравнение: Текущее vs Production-Ready

| Компонент | Текущее Решение | Production-Ready | Критичность |
|-----------|----------------|------------------|--------------|
| Runtime Monitoring | ❌ Нет | ✅ Falco | ВЫСОКАЯ |
| Image Scanning | ❌ Нет | ✅ Trivy | ВЫСОКАЯ |
| Audit Logs | ❌ Нет | ✅ Kubernetes Audit | ВЫСОКАЯ |
| Network Policies | ❌ Нет | ✅ Network Policies | СРЕДНЯЯ |
| Process Safelisting | ❌ Нет | ✅ Pod Security Policies | СРЕДНЯЯ |
| Node Scanning | ✅ ClamAV/rkhunter | ✅ ClamAV/rkhunter | СРЕДНЯЯ |
| Centralized Logging | ❌ Нет | ✅ Loki | НИЗКАЯ |

---

## Вывод

Текущее решение подходит для **базовой проверки**, но **недостаточно для production**.

Для production окружения **критично** добавить:
1. **Falco** - для runtime security monitoring
2. **Trivy** - для сканирования образов
3. **Kubernetes Audit Logs** - для отслеживания API активности

Эти инструменты являются industry standard и используются в production окружениях крупных компаний.







