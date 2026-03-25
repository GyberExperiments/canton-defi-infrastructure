# 🔧 ПЛАН ВОССТАНОВЛЕНИЯ И ОРГАНИЗАЦИИ KUBERNETES КЛАСТЕРА

## 📊 АНАЛИЗ КОРНЕВЫХ ПРИЧИН ПРОБЛЕМ

### 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

#### 1. КОНФЛИКТ INGRESS CONTROLLERS
**Проблема:**
- В кластере установлен только **Traefik** (`ingressClassName: traefik`)
- Но 11 ingress используют **Istio** (не установлен/не работает)
- 1 ingress использует **Nginx** (не установлен/не работает)
- Эти ingress не могут быть обработаны, но cert-manager все равно создает для них Certificate и Challenge поды

**Найденные проблемные ingress:**
```
default/auradomus-acme-challenge: istio
default/cm-acme-http-solver-sdtzg: istio
develop-gprod/cm-acme-http-solver-hql28: istio
istio-system/cm-acme-http-solver-*: istio (5 штук)
prod-pswmeta/cm-acme-http-solver-ncgkf: istio
stage-pswmeta/cm-acme-http-solver-nl9d5: istio
supabase/supabase-ingress: nginx
```

**Последствия:**
- Cert-manager создает Challenge поды для ingress, которые не могут быть обработаны
- Challenge поды остаются в Pending (не могут быть запланированы)
- Cert-manager создает новые Challenge, старые не удаляются
- Накопление тысяч Pending подов

#### 2. РАЗНООБРАЗИЕ CLUSTERISSUER
**Проблема:**
- В кластере 3 разных ClusterIssuer:
  - `letsencrypt-prod` (используется большинством)
  - `letsencrypt-production` (используется некоторыми проектами)
  - `letsencrypt-staging` (используется для stage окружений)
- Разные проекты используют разные issuer'ы без единой стратегии

**Найденные использования:**
- `letsencrypt-prod`: canton-otc, maximus, DSP, tech-hy-ecosystem
- `letsencrypt-production`: multi-swarm-system, aura-domus, GPROD
- `letsencrypt-staging`: multi-swarm-system (stage)

**Последствия:**
- Сложность управления сертификатами
- Потенциальные конфликты при обновлении
- Нет единой стратегии обновления сертификатов

#### 3. АВТОМАТИЧЕСКОЕ СОЗДАНИЕ CERTIFICATE РЕСУРСОВ
**Проблема:**
- Все ingress с аннотацией `cert-manager.io/cluster-issuer` автоматически создают Certificate ресурсы
- Нет явного управления Certificate ресурсами
- Certificate создаются даже для неработающих ingress (istio, nginx)

**Текущее состояние:**
- 27 Certificate ресурсов в кластере
- Множество Challenges в статусе `pending`
- Особенно проблемные для istio ingress

#### 4. ОТСУТСТВИЕ ЕДИНОЙ ОРГАНИЗАЦИИ
**Проблема:**
- Каждый проект создает свои ingress конфигурации независимо
- Нет единых стандартов и best practices
- Нет централизованного управления
- Дублирование конфигураций

---

## 🎯 ПЛАН ВОССТАНОВЛЕНИЯ

### ЭТАП 1: КРИТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ (ПРИОРИТЕТ 1)

#### Шаг 1.1: Остановить cert-manager
```bash
# Остановить cert-manager, чтобы прекратить создание новых challenge подов
kubectl scale deployment cert-manager -n cert-manager --replicas=0
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=0
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=0
```

#### Шаг 1.2: Удалить проблемные ingress (istio, nginx)
```bash
# Удалить все ingress, использующие istio
kubectl get ingress -A -o json | \
  jq -r '.items[] | select(.spec.ingressClassName == "istio" or .metadata.annotations."kubernetes.io/ingress.class" == "istio") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete ingress $name -n $ns --ignore-not-found
  done

# Удалить ingress, использующие nginx
kubectl delete ingress supabase-ingress -n supabase --ignore-not-found
```

#### Шаг 1.3: Удалить проблемные Certificate ресурсы
```bash
# Удалить Certificate для istio ingress
kubectl get certificate -A -o json | \
  jq -r '.items[] | select(.metadata.namespace == "istio-system" or .metadata.name | contains("istio")) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete certificate $name -n $ns --ignore-not-found
  done

# Удалить Certificate для nginx ingress
kubectl delete certificate supabase-tls -n supabase --ignore-not-found
```

#### Шаг 1.4: Массовая очистка Pending подов
```bash
# Удалить все Pending поды (особенно cert-manager challenge поды)
kubectl get pods -A --field-selector status.phase=Pending -o json | \
  jq -r '.items[] | select(.metadata.name | startswith("cm-acme-http-solver")) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete pod $name -n $ns --grace-period=0 --force --ignore-not-found
  done

# Удалить старые Pending поды (старше 1 часа)
kubectl get pods -A --field-selector status.phase=Pending -o json | \
  jq -r '.items[] | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete pod $name -n $ns --grace-period=0 --force --ignore-not-found
  done
```

#### Шаг 1.5: Очистить зависшие Challenge ресурсы
```bash
# Удалить все pending Challenge
kubectl get challenges -A -o json | \
  jq -r '.items[] | select(.status.state == "pending" or .status.state == null) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete challenge $name -n $ns --ignore-not-found
  done
```

#### Шаг 1.6: Очистить зависшие CertificateRequest и Order
```bash
# Удалить pending CertificateRequest
kubectl get certificaterequests -A -o json | \
  jq -r '.items[] | select(.status.conditions[]?.status == "False" or .status.conditions == null) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete certificaterequest $name -n $ns --ignore-not-found
  done

# Удалить pending Order
kubectl get orders -A -o json | \
  jq -r '.items[] | select(.status.state == "pending" or .status.state == null) | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete order $name -n $ns --ignore-not-found
  done
```

### ЭТАП 2: ИСПРАВЛЕНИЕ КОНФИГУРАЦИЙ (ПРИОРИТЕТ 2)

#### Шаг 2.1: Исправить ingress конфигурации в проектах

**Проблемные файлы для исправления:**

1. **supabase ingress** (`canton-otc/k8s/supabase/ingress.yaml`):
   - Изменить `ingressClassName: nginx` → `ingressClassName: traefik`
   - Удалить аннотации nginx, добавить traefik аннотации

2. **aura-domus ingress** (`aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml`):
   - Изменить `kubernetes.io/ingress.class: "istio"` → `ingressClassName: traefik`
   - Удалить istio аннотации, добавить traefik аннотации

3. **Другие проекты с istio/nginx**:
   - Найти все ingress с istio/nginx и исправить на traefik

#### Шаг 2.2: Унифицировать ClusterIssuer

**Стратегия:**
- Использовать `letsencrypt-prod` для всех production окружений
- Использовать `letsencrypt-staging` для всех stage окружений
- Удалить `letsencrypt-production` (слишком похож на prod, может вызывать путаницу)

**Действия:**
1. Обновить все ingress конфигурации на использование `letsencrypt-prod` или `letsencrypt-staging`
2. Обновить существующие Certificate ресурсы
3. Удалить неиспользуемый `letsencrypt-production` ClusterIssuer (опционально)

#### Шаг 2.3: Настроить правильную конфигурацию cert-manager

**Параметры для cert-manager:**
```yaml
args:
  - --max-concurrent-challenges=5  # Ограничить одновременные challenge
  - --acme-http01-solver-pod-grace-period=1m  # Автоочистка solver подов
  - --enable-certificate-owner-ref=true  # Автоматическое удаление при удалении Certificate
```

### ЭТАП 3: ВОССТАНОВЛЕНИЕ РАБОТЫ (ПРИОРИТЕТ 3)

#### Шаг 3.1: Перезапустить cert-manager
```bash
# Применить правильную конфигурацию
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--max-concurrent-challenges=5"},
  {"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--acme-http01-solver-pod-grace-period=1m"},
  {"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--enable-certificate-owner-ref=true"}
]'

# Запустить cert-manager
kubectl scale deployment cert-manager -n cert-manager --replicas=1
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1
```

#### Шаг 3.2: Применить исправленные ingress конфигурации
```bash
# Применить исправленные ingress для каждого проекта
kubectl apply -f canton-otc/k8s/supabase/ingress.yaml
# и т.д. для других проектов
```

#### Шаг 3.3: Проверить восстановление
```bash
# Проверить количество Pending подов
kubectl get pods -A --field-selector status.phase=Pending | wc -l

# Проверить статус Certificate
kubectl get certificates -A

# Проверить статус Challenges
kubectl get challenges -A

# Проверить нагрузку на control-plane
kubectl top node tmedm
```

---

## 📋 ПЛАН ОРГАНИЗАЦИИ КЛАСТЕРА

### СТАНДАРТЫ И BEST PRACTICES

#### 1. ЕДИНЫЙ INGRESS CONTROLLER
- **Использовать только Traefik** для всех проектов
- Не использовать nginx или istio, если они не установлены
- Все ingress должны использовать `ingressClassName: traefik`

#### 2. ЕДИНАЯ СТРАТЕГИЯ СЕРТИФИКАТОВ
- **Production**: использовать `letsencrypt-prod`
- **Staging**: использовать `letsencrypt-staging`
- Явно создавать Certificate ресурсы вместо автоматического создания через аннотации

#### 3. ОРГАНИЗАЦИЯ NAMESPACE
- Каждый проект в своем namespace
- Именование: `project-name` или `project-name-env`
- Примеры: `canton-otc`, `maximus`, `dsp-prod`, `dsp-stage`

#### 4. УПРАВЛЕНИЕ CERTIFICATE РЕСУРСАМИ
- **Явное создание Certificate ресурсов** вместо автоматического через аннотации
- Certificate должен быть в том же namespace, что и ingress
- Именование: `project-name-tls` или `project-name-env-tls`

#### 5. МОНИТОРИНГ И ОЧИСТКА
- Регулярная очистка старых Pending подов (cronjob)
- Мониторинг количества Challenge подов
- Алерты при превышении лимитов

### СТРУКТУРА КОНФИГУРАЦИЙ

```
project-name/
  k8s/
    namespace.yaml
    deployment.yaml
    service.yaml
    certificate.yaml      # Явный Certificate ресурс
    ingress.yaml          # Ingress с ссылкой на Certificate
    secrets.yaml
```

### ШАБЛОН INGRESS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: project-name-ingress
  namespace: project-name
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    # НЕ использовать cert-manager.io/cluster-issuer здесь!
    # Вместо этого создать явный Certificate ресурс
spec:
  ingressClassName: traefik  # ТОЛЬКО traefik!
  tls:
  - hosts:
    - example.com
    secretName: project-name-tls  # Secret создается Certificate ресурсом
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: project-name-service
            port:
              number: 80
```

### ШАБЛОН CERTIFICATE

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: project-name-tls
  namespace: project-name
spec:
  secretName: project-name-tls
  dnsNames:
  - example.com
  - www.example.com
  issuerRef:
    kind: ClusterIssuer
    name: letsencrypt-prod  # или letsencrypt-staging для stage
```

---

## 🔍 КОМАНДЫ ДЛЯ ПРОВЕРКИ

### Проверка состояния кластера
```bash
# Количество Pending подов
kubectl get pods -A --field-selector status.phase=Pending | wc -l

# Количество Challenge подов
kubectl get pods -A | grep cm-acme-http-solver | wc -l

# Статус Certificate
kubectl get certificates -A

# Статус Challenges
kubectl get challenges -A

# Нагрузка на узлы
kubectl top nodes

# Проблемные ingress
kubectl get ingress -A -o json | \
  jq -r '.items[] | select(.spec.ingressClassName != "traefik" and (.metadata.annotations."kubernetes.io/ingress.class" // "") != "traefik") | "\(.metadata.namespace)/\(.metadata.name): \(.spec.ingressClassName // .metadata.annotations."kubernetes.io/ingress.class" // "none")"'
```

---

## 📝 ЧЕКЛИСТ ВОССТАНОВЛЕНИЯ

- [ ] Остановить cert-manager
- [ ] Удалить проблемные ingress (istio, nginx)
- [ ] Удалить проблемные Certificate ресурсы
- [ ] Очистить Pending поды
- [ ] Очистить Challenge ресурсы
- [ ] Очистить CertificateRequest и Order
- [ ] Исправить ingress конфигурации в проектах
- [ ] Унифицировать ClusterIssuer
- [ ] Настроить cert-manager правильно
- [ ] Перезапустить cert-manager
- [ ] Применить исправленные конфигурации
- [ ] Проверить восстановление
- [ ] Создать документацию по стандартам
- [ ] Настроить мониторинг и очистку

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. Выполнить ЭТАП 1 (критическое восстановление)
2. Выполнить ЭТАП 2 (исправление конфигураций)
3. Выполнить ЭТАП 3 (восстановление работы)
4. Создать скрипты автоматизации для регулярной очистки
5. Обновить все проекты согласно новым стандартам

---

**ВАЖНО:** Все изменения должны быть протестированы на stage окружениях перед применением на production.
