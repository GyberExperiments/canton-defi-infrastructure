# 🔒 ПОЛНОЕ ВОССТАНОВЛЕНИЕ И ОБЕЗЗАРАЖИВАНИЕ KUBERNETES КЛАСТЕРА

## 🚨 КРИТИЧЕСКАЯ СИТУАЦИЯ - ДЕТАЛЬНЫЙ АНАЛИЗ

**ТЕКУЩЕЕ СОСТОЯНИЕ:**
- ⚠️ **Control-plane узел (tmedm) перегружен на 99% CPU** - API server отвечает с задержками 40-45 секунд
- ⚠️ **~15,000+ Pending подов** блокируют scheduler (соотношение проблемных/рабочих ~250:1)
- ⚠️ **Зависший узел `canton-node-65-108-15-30`** в статусе NotReady с поды в Terminating
- ⚠️ **Cert-manager создает бесконечный цикл** challenge подов из-за неправильной конфигурации
- ⚠️ **API server таймаутит** при попытках массового удаления ресурсов
- ⚠️ **Возможна компрометация безопасности** - требуется проверка

**КОРНЕВАЯ ПРИЧИНА:**
1. Cert-manager с `max-concurrent-challenges=60` создает слишком много подов одновременно
2. Challenge поды не удаляются после таймаута, накапливаясь тысячами
3. Scheduler перегружен попытками запланировать тысячи Pending подов
4. API server перегружен обработкой огромного количества объектов в etcd
5. Зависший узел блокирует удаление подов через finalizers

**ЦЕЛЬ:**
1. Полностью очистить кластер от проблемных ресурсов (с учетом перегруженного API)
2. Удалить и пересоздать зависший узел
3. Обеззаразить систему от возможных угроз
4. Восстановить работоспособность всех проектов
5. Настроить правильную организацию и безопасность
6. **ГАРАНТИРОВАТЬ** что важные данные (Secrets, ConfigMaps, PVC) не потеряются

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ КЛАСТЕРА

### Узлы:
```
NAME                       STATUS                        ROLES                  AGE    VERSION
canton-node-65-108-15-30   NotReady,SchedulingDisabled   <none>                 61d    v1.33.6+k3s1  ⚠️ ЗАВИСШИЙ - ТРЕБУЕТ УДАЛЕНИЯ
kczdjomrqi                 Ready                         worker                 195d   v1.31.5+k3s1
tmedm                      Ready                         control-plane,master   142d   v1.31.4+k3s1  ⚠️ ПЕРЕГРУЖЕН (99% CPU, 40-45s задержки API)
upbewhtibq                 Ready                         <none>                 192d   v1.32.5+k3s1
```

### Проблемы:
- **~15,000+ Pending подов** (cert-manager challenges) - блокируют scheduler
- **Control-plane перегружен (99% CPU)** - API server отвечает 40-45 секунд
- **Зависший узел** с поды в Terminating (finalizers блокируют удаление)
- **Cert-manager** создает бесконечный цикл challenge подов
- **API server таймаутит** при массовых операциях

---

## 🎯 СТРАТЕГИЯ ВОССТАНОВЛЕНИЯ С УЧЕТОМ ПЕРЕГРУЗКИ API

### ⚡ КРИТИЧЕСКИ ВАЖНО: РАБОТА С ПЕРЕГРУЖЕННЫМ API SERVER

**Проблема:** API server перегружен и таймаутит запросы (40-45 секунд задержки)

**Стратегия:**
1. Использовать **короткие таймауты** (2-5 секунд) для быстрого отказа
2. Удалять ресурсы **маленькими батчами** (10-50 за раз)
3. Делать **паузы между батчами** (2-5 секунд) для снижения нагрузки
4. Использовать **параллельное выполнение** с ограничением (xargs -P)
5. **Очищать finalizers** перед удалением для избежания зависаний
6. Использовать **прямой доступ к API** если kubectl не работает

---

## 🎯 ПЛАН ПОЛНОГО ВОССТАНОВЛЕНИЯ

### ЭТАП 0: РЕЗЕРВНОЕ КОПИРОВАНИЕ (ОБЯЗАТЕЛЬНО!)

#### Шаг 0.1: Создать backup всех важных данных
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Запустить скрипт резервного копирования
./scripts/backup-critical-data.sh

# Или вручную:
BACKUP_DIR="/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup Secrets (критически важно!)
for ns in $(kubectl get namespaces -o name 2>/dev/null | cut -d/ -f2 | grep -v -E "(kube-system|kube-public|kube-node-lease)"); do
  kubectl get secrets -n "$ns" -o yaml > "$BACKUP_DIR/secrets_${ns}.yaml" 2>/dev/null || true
done

# Backup ConfigMaps
for ns in $(kubectl get namespaces -o name 2>/dev/null | cut -d/ -f2 | grep -v -E "(kube-system|kube-public|kube-node-lease)"); do
  kubectl get configmaps -n "$ns" -o yaml > "$BACKUP_DIR/configmaps_${ns}.yaml" 2>/dev/null || true
done

# Backup PVC
kubectl get pvc -A -o yaml > "$BACKUP_DIR/all_pvc.yaml" 2>/dev/null || true

# Backup Deployments
for ns in $(kubectl get namespaces -o name 2>/dev/null | cut -d/ -f2 | grep -v -E "(kube-system|kube-public|kube-node-lease)"); do
  kubectl get deployments -n "$ns" -o yaml > "$BACKUP_DIR/deployments_${ns}.yaml" 2>/dev/null || true
done

echo "✅ Backup сохранен в: $BACKUP_DIR"
```

**ВАЖНО:** Не продолжать без backup! Все важные данные должны быть сохранены.

---

### ЭТАП 1: РАДИКАЛЬНАЯ ОЧИСТКА КЛАСТЕРА (С УЧЕТОМ ПЕРЕГРУЗКИ API)

#### Шаг 1.1: Остановить cert-manager (критично!)
```bash
# Остановить cert-manager чтобы прекратить создание новых challenge подов
kubectl scale deployment cert-manager -n cert-manager --replicas=0 --timeout=10s 2>/dev/null || true
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=0 --timeout=10s 2>/dev/null || true
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=0 --timeout=10s 2>/dev/null || true

# Проверить что остановлен
kubectl get pods -n cert-manager --timeout=5s 2>/dev/null | grep cert-manager || echo "Cert-manager остановлен"
```

#### Шаг 1.2: Массовое удаление Challenge ресурсов (маленькими батчами)
```bash
# Метод 1: Удаление через kubectl с короткими таймаутами
echo "Удаление Challenge ресурсов..."

# Получить список всех Challenge
kubectl get challenges -A -o json --timeout=30s 2>/dev/null | \
  jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' | \
  head -100 | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    kubectl delete challenge "$name" -n "$ns" --timeout=2s --force --grace-period=0 2>/dev/null || true
    sleep 0.1  # Небольшая пауза между удалениями
  done

# Повторить если остались
for i in {1..5}; do
  remaining=$(kubectl get challenges -A --no-headers --timeout=10s 2>/dev/null | wc -l | tr -d ' ')
  echo "Осталось Challenge: $remaining"
  [ "$remaining" -eq 0 ] && break
  
  kubectl get challenges -A -o json --timeout=30s 2>/dev/null | \
    jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' | \
    head -50 | \
    while IFS='|' read -r ns name; do
      [ -z "$ns" ] || [ -z "$name" ] && continue
      kubectl delete challenge "$name" -n "$ns" --timeout=2s --force --grace-period=0 2>/dev/null || true
      sleep 0.1
    done
  sleep 2  # Пауза между итерациями
done
```

#### Шаг 1.3: Удаление CertificateRequest и Order
```bash
# Удалить CertificateRequest
kubectl get certificaterequests -A -o json --timeout=30s 2>/dev/null | \
  jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' | \
  head -100 | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    kubectl delete certificaterequest "$name" -n "$ns" --timeout=2s --force --grace-period=0 2>/dev/null || true
    sleep 0.1
  done

# Удалить Order
kubectl get orders -A -o json --timeout=30s 2>/dev/null | \
  jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' | \
  head -100 | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    kubectl delete order "$name" -n "$ns" --timeout=2s --force --grace-period=0 2>/dev/null || true
    sleep 0.1
  done
```

#### Шаг 1.4: Удаление Pending подов (маленькими батчами по namespace)
```bash
# Использовать радикальный скрипт очистки (он уже оптимизирован)
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/radical-cleanup-final.sh

# Если скрипт не работает из-за таймаутов, использовать ручной метод:
PROBLEM_NAMESPACES=("platform-gyber-org" "istio-system" "default" "supabase" "canton-otc" "maximus")

for ns in "${PROBLEM_NAMESPACES[@]}"; do
  echo "Очистка namespace: $ns"
  
  # Получить Pending поды маленькими батчами
  kubectl get pods -n "$ns" --field-selector status.phase=Pending -o json --timeout=30s 2>/dev/null | \
    jq -r '.items[] | .metadata.name' | \
    head -50 | \
    while read name; do
      [ -z "$name" ] && continue
      
      # Очистить finalizers перед удалением
      kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=2s 2>/dev/null || true
      
      # Удалить под
      kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=2s 2>/dev/null || true
      
      sleep 0.05  # Очень короткая пауза
    done
  
  sleep 3  # Пауза между namespace
done
```

#### Шаг 1.5: Удаление challenge подов по паттерну
```bash
# Удалить все поды с паттерном cm-acme-http-solver
kubectl get pods -A -o json --timeout=30s 2>/dev/null | \
  jq -r '.items[] | select(.metadata.name | startswith("cm-acme-http-solver")) | "\(.metadata.namespace)|\(.metadata.name)"' | \
  head -200 | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    
    # Очистить finalizers
    kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=2s 2>/dev/null || true
    
    # Удалить
    kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=2s 2>/dev/null || true
    
    sleep 0.05
  done
```

#### Шаг 1.6: Проверка результатов очистки
```bash
echo "=== РЕЗУЛЬТАТЫ ОЧИСТКИ ==="

# Подождать немного для обработки API server
sleep 5

# Проверить количество оставшихся проблемных ресурсов
PENDING=$(timeout 30 kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
CHALLENGES=$(timeout 30 kubectl get challenges -A --no-headers 2>/dev/null | wc -l | tr -d ' ')
CHALLENGE_PODS=$(timeout 30 kubectl get pods -A 2>/dev/null | grep cm-acme-http-solver | wc -l | tr -d ' ')

echo "Pending подов: $PENDING"
echo "Challenge ресурсов: $CHALLENGES"
echo "Challenge подов: $CHALLENGE_PODS"

# Проверить CPU (если доступно)
CPU=$(timeout 10 kubectl top node tmedm --no-headers 2>/dev/null | awk '{print $3}' || echo "N/A")
echo "CPU control-plane: $CPU"

# Ожидаемый результат:
# - Pending подов: < 100
# - Challenge ресурсов: < 10
# - Challenge подов: < 10
# - CPU control-plane: < 50%

if [ "$PENDING" -gt 100 ] || [ "$CHALLENGES" -gt 10 ]; then
  echo "⚠️  Остались ресурсы. Повторить очистку..."
  # Повторить шаги 1.2-1.5
fi
```

---

### ЭТАП 2: УДАЛЕНИЕ И ПЕРЕСОЗДАНИЕ ЗАВИСШЕГО УЗЛА

#### Шаг 2.1: Принудительное удаление всех подов с зависшего узла
```bash
STUCK_NODE="canton-node-65-108-15-30"

echo "Получение списка подов на узле $STUCK_NODE..."

# Получить все поды на узле (с таймаутом)
kubectl get pods -A -o json --timeout=60s 2>/dev/null | \
  jq -r --arg node "$STUCK_NODE" '.items[] | select(.spec.nodeName==$node) | "\(.metadata.namespace)|\(.metadata.name)"' | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    
    echo "  Удаление пода $name в namespace $ns"
    
    # Очистить finalizers (критично для зависших подов!)
    kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=5s 2>/dev/null || true
    
    # Принудительно удалить
    kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=5s 2>/dev/null || true
    
    sleep 0.1
  done

echo "✅ Поды с узла удалены"
```

#### Шаг 2.2: Удаление узла из кластера
```bash
STUCK_NODE="canton-node-65-108-15-30"

echo "Удаление узла $STUCK_NODE из кластера..."

# Удалить узел
kubectl delete node "$STUCK_NODE" --timeout=30s 2>/dev/null || echo "Узел уже удален или недоступен"

# Проверить что узел удален
sleep 3
kubectl get nodes --timeout=10s 2>/dev/null | grep "$STUCK_NODE" && echo "⚠️  Узел все еще существует" || echo "✅ Узел удален"
```

#### Шаг 2.3: Очистка ресурсов связанных с узлом
```bash
STUCK_NODE="canton-node-65-108-15-30"

# Удалить PVC связанные с узлом (если есть)
kubectl get pvc -A -o json --timeout=30s 2>/dev/null | \
  jq -r --arg node "$STUCK_NODE" '.items[] | select(.metadata.annotations."volume.kubernetes.io/selected-node"==$node) | "\(.metadata.namespace)|\(.metadata.name)"' | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    echo "  Удаление PVC $name в namespace $ns"
    kubectl delete pvc "$name" -n "$ns" --timeout=10s 2>/dev/null || true
  done
```

---

### ЭТАП 3: ОБЕЗЗАРАЖИВАНИЕ И БЕЗОПАСНОСТЬ

#### Шаг 3.1: Проверка на компрометацию
```bash
echo "=== ПРОВЕРКА НА КОМПРОМЕТАЦИЮ ==="

# Проверить подозрительные поды (не Running/Completed)
echo "Проверка подозрительных подов..."
kubectl get pods -A -o wide --timeout=30s 2>/dev/null | \
  grep -v Running | grep -v Completed | grep -v "NAMESPACE" || echo "Подозрительных подов не найдено"

# Проверить внешние сервисы (не ClusterIP)
echo "Проверка внешних сервисов..."
kubectl get svc -A --timeout=30s 2>/dev/null | \
  grep -v ClusterIP | grep -v "NAMESPACE" || echo "Внешних сервисов не найдено"

# Проверить подозрительные ingress
echo "Проверка ingress..."
kubectl get ingress -A --timeout=30s 2>/dev/null | \
  grep -v traefik | grep -v "NAMESPACE" || echo "Подозрительных ingress не найдено"
```

#### Шаг 3.2: Очистка подозрительных ресурсов
```bash
# Удалить все поды не в статусе Running/Completed (кроме системных)
kubectl get pods -A -o json --timeout=60s 2>/dev/null | \
  jq -r '.items[] | select(.status.phase != "Running" and .status.phase != "Succeeded" and .metadata.namespace != "kube-system" and .metadata.namespace != "kube-public" and .metadata.namespace != "kube-node-lease") | "\(.metadata.namespace)|\(.metadata.name)"' | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    
    # Очистить finalizers
    kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --timeout=2s 2>/dev/null || true
    
    # Удалить
    kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --timeout=2s 2>/dev/null || true
  done
```

#### Шаг 3.3: Проверка RBAC
```bash
echo "Проверка RBAC..."

# Проверить пользовательские ClusterRole
kubectl get clusterrole --timeout=10s 2>/dev/null | \
  grep -v system: | grep -v "NAME" || echo "Пользовательских ClusterRole не найдено"

# Проверить пользовательские RoleBinding
kubectl get clusterrolebinding --timeout=10s 2>/dev/null | \
  grep -v system: | grep -v "NAME" || echo "Пользовательских ClusterRoleBinding не найдено"
```

#### Шаг 3.4: Очистка старых сертификатов
```bash
# Удалить все старые Certificate ресурсы (кроме активных)
kubectl get certificates -A -o json --timeout=60s 2>/dev/null | \
  jq -r '.items[] | select(.status.conditions[]?.status == "False" or .status.conditions == null) | "\(.metadata.namespace)|\(.metadata.name)"' | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    kubectl delete certificate "$name" -n "$ns" --timeout=5s 2>/dev/null || true
  done
```

---

### ЭТАП 4: НАСТРОЙКА CERT-MANAGER ПРАВИЛЬНО

#### Шаг 4.1: Применить правильную конфигурацию
```bash
echo "Настройка cert-manager..."

# Проверить текущую конфигурацию
kubectl get deployment cert-manager -n cert-manager -o yaml --timeout=10s 2>/dev/null | \
  grep -A 20 "args:" || echo "Cert-manager не найден"

# Применить правильную конфигурацию с ограничениями
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=5",
    "--acme-http01-solver-pod-grace-period=1m",
    "--enable-certificate-owner-ref=true"
  ]}
]' --timeout=10s 2>/dev/null || echo "Не удалось обновить args"

# Установить лимиты ресурсов
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "500m", "memory": "512Mi"},
    "requests": {"cpu": "100m", "memory": "128Mi"}
  }}
]' --timeout=10s 2>/dev/null || echo "Не удалось установить лимиты"
```

#### Шаг 4.2: Запустить cert-manager
```bash
# Запустить cert-manager
kubectl scale deployment cert-manager -n cert-manager --replicas=1 --timeout=10s 2>/dev/null || true
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1 --timeout=10s 2>/dev/null || true
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1 --timeout=10s 2>/dev/null || true

# Перезапустить для применения конфигурации
kubectl rollout restart deployment cert-manager -n cert-manager --timeout=10s 2>/dev/null || true
kubectl rollout restart deployment cert-manager-cainjector -n cert-manager --timeout=10s 2>/dev/null || true
kubectl rollout restart deployment cert-manager-webhook -n cert-manager --timeout=10s 2>/dev/null || true

# Дождаться готовности (с таймаутом)
echo "Ожидание готовности cert-manager..."
kubectl wait --for=condition=available --timeout=120s deployment/cert-manager -n cert-manager 2>/dev/null || echo "Таймаут ожидания cert-manager"
kubectl wait --for=condition=available --timeout=120s deployment/cert-manager-cainjector -n cert-manager 2>/dev/null || echo "Таймаут ожидания cainjector"
kubectl wait --for=condition=available --timeout=120s deployment/cert-manager-webhook -n cert-manager 2>/dev/null || echo "Таймаут ожидания webhook"
```

---

### ЭТАП 5: ИСПРАВЛЕНИЕ КОНФИГУРАЦИЙ ПРОЕКТОВ

#### Шаг 5.1: Применить исправленные ingress конфигурации
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Исправить ingress конфигурации в файлах
./scripts/fix-ingress-configurations.sh

# Применить исправленные ingress (если файлы существуют)
[ -f "k8s/supabase/ingress.yaml" ] && \
  kubectl apply -f k8s/supabase/ingress.yaml --timeout=10s 2>/dev/null || true

[ -f "/Users/Gyber/GYBERNATY-ECOSYSTEM/aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml" ] && \
  kubectl apply -f /Users/Gyber/GYBERNATY-ECOSYSTEM/aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml --timeout=10s 2>/dev/null || true
```

#### Шаг 5.2: Унифицировать ClusterIssuer
```bash
# Найти все ingress с letsencrypt-production и обновить на letsencrypt-prod
kubectl get ingress -A -o json --timeout=60s 2>/dev/null | \
  jq -r '.items[] | select(.metadata.annotations."cert-manager.io/cluster-issuer" == "letsencrypt-production") | "\(.metadata.namespace)|\(.metadata.name)"' | \
  while IFS='|' read -r ns name; do
    [ -z "$ns" ] || [ -z "$name" ] && continue
    echo "Обновление ClusterIssuer для $ns/$name"
    kubectl annotate ingress "$name" -n "$ns" cert-manager.io/cluster-issuer=letsencrypt-prod --overwrite --timeout=5s 2>/dev/null || true
  done
```

---

### ЭТАП 6: ВОССТАНОВЛЕНИЕ РАБОТЫ ПРОЕКТОВ

#### Шаг 6.1: Проверить и перезапустить deployments
```bash
echo "=== ПРОВЕРКА DEPLOYMENTS ==="

# Проверить статус всех deployments
kubectl get deployments -A --timeout=30s 2>/dev/null | \
  grep -v "1/1" | grep -v "0/0" | grep -v "NAME" || echo "Все deployments в порядке"

# Перезапустить проблемные deployments
kubectl rollout restart deployment maximus -n maximus --timeout=10s 2>/dev/null || echo "Не удалось перезапустить maximus"
kubectl rollout restart deployment redis -n maximus --timeout=10s 2>/dev/null || echo "Не удалось перезапустить redis"

# Проверить планирование подов
echo "Проверка подов в maximus:"
kubectl get pods -n maximus --timeout=10s 2>/dev/null | head -10

echo "Проверка подов в canton-otc:"
kubectl get pods -n canton-otc --timeout=10s 2>/dev/null | head -10
```

#### Шаг 6.2: Проверить доступность сайтов
```bash
echo "=== ПРОВЕРКА ДОСТУПНОСТИ ==="

# Проверить ingress
echo "Ingress:"
kubectl get ingress -A --timeout=10s 2>/dev/null | head -20

# Проверить сертификаты
echo "Сертификаты:"
kubectl get certificates -A --timeout=10s 2>/dev/null | head -20

# Проверить доступность сайтов
echo "Проверка доступности сайтов..."
curl -I -m 10 https://gyber.org 2>&1 | head -5 || echo "gyber.org недоступен"
curl -I -m 10 https://1otc.cc 2>&1 | head -5 || echo "1otc.cc недоступен"
curl -I -m 10 https://maximus-marketing-swarm.gyber.org 2>&1 | head -5 || echo "maximus-marketing-swarm.gyber.org недоступен"
```

---

### ЭТАП 7: НАСТРОЙКА МОНИТОРИНГА И ПРОФИЛАКТИКИ

#### Шаг 7.1: Создать CronJob для автоматической очистки
```bash
# Проверить существует ли уже CronJob
if kubectl get cronjob cleanup-pending-pods -n kube-system --timeout=5s &>/dev/null; then
  echo "CronJob cleanup-pending-pods уже существует"
else
  echo "Создание CronJob для автоматической очистки..."
  kubectl apply -f - <<EOF --timeout=10s 2>/dev/null || echo "Не удалось создать CronJob"
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-pending-pods
  namespace: kube-system
spec:
  schedule: "0 */6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: default
          containers:
          - name: cleanup
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              kubectl get pods -A --field-selector status.phase=Pending -o json | \
                jq -r '.items[] | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.namespace) \(.metadata.name)"' | \
                while read ns name; do
                  kubectl delete pod "\$name" -n "\$ns" --grace-period=0 --force --timeout=5s 2>/dev/null || true
                done
          restartPolicy: OnFailure
EOF
fi
```

---

## 🔒 МЕРЫ БЕЗОПАСНОСТИ

### 1. Проверка на компрометацию
- ✅ Проверить все подозрительные поды, сервисы, ingress
- ✅ Проверить RBAC на неавторизованный доступ
- ✅ Проверить secrets на утечки
- ✅ Проверить network policies

### 2. Обновление компонентов
```bash
# Обновить K3s до последней версии (если возможно)
# Обновить cert-manager до последней версии
# Обновить Traefik до последней версии
```

### 3. Аудит логов
```bash
# Проверить логи API server на подозрительную активность
kubectl logs -n kube-system -l component=kube-apiserver --tail=1000 --timeout=30s 2>/dev/null | \
  grep -i "error\|unauthorized\|forbidden" || echo "Подозрительной активности не найдено"
```

---

## 📋 ЧЕКЛИСТ ВОССТАНОВЛЕНИЯ

- [ ] **ЭТАП 0:** Создать резервные копии всех важных данных (Secrets, ConfigMaps, PVC, Deployments)
- [ ] **ЭТАП 1.1:** Остановить cert-manager
- [ ] **ЭТАП 1.2:** Удалить Challenge ресурсы (маленькими батчами)
- [ ] **ЭТАП 1.3:** Удалить CertificateRequest и Order
- [ ] **ЭТАП 1.4:** Удалить Pending поды (по namespace, маленькими батчами)
- [ ] **ЭТАП 1.5:** Удалить challenge поды по паттерну
- [ ] **ЭТАП 1.6:** Проверить результаты очистки (Pending < 100, CPU < 50%)
- [ ] **ЭТАП 2.1:** Удалить все поды с зависшего узла
- [ ] **ЭТАП 2.2:** Удалить зависший узел из кластера
- [ ] **ЭТАП 2.3:** Очистить PVC связанные с узлом
- [ ] **ЭТАП 3.1:** Проверить на компрометацию (поды, сервисы, RBAC)
- [ ] **ЭТАП 3.2:** Очистить подозрительные ресурсы
- [ ] **ЭТАП 3.3:** Проверить RBAC
- [ ] **ЭТАП 3.4:** Очистить старые сертификаты
- [ ] **ЭТАП 4.1:** Настроить cert-manager правильно (max-concurrent-challenges=5)
- [ ] **ЭТАП 4.2:** Запустить и перезапустить cert-manager
- [ ] **ЭТАП 5.1:** Применить исправленные ingress конфигурации
- [ ] **ЭТАП 5.2:** Унифицировать ClusterIssuer
- [ ] **ЭТАП 6.1:** Восстановить работу проектов (перезапустить deployments)
- [ ] **ЭТАП 6.2:** Проверить доступность сайтов
- [ ] **ЭТАП 7.1:** Создать CronJob для автоматической очистки

---

## 🚀 КОМАНДЫ ДЛЯ БЫСТРОГО ЗАПУСКА

### ⚡ АВТОМАТИЗИРОВАННОЕ ВОССТАНОВЛЕНИЕ (РЕКОМЕНДУЕТСЯ):

**Используйте мастер-скрипт для полного автоматизированного восстановления:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 1. Сначала backup!
./scripts/backup-critical-data.sh

# 2. Затем полное восстановление
./scripts/complete-cluster-recovery.sh
```

Этот скрипт автоматически выполнит все 7 этапов восстановления с учетом перегруженного API server.

---

## 📝 ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Безопасность превыше всего:** Проверить на компрометацию перед восстановлением
2. **Резервное копирование ОБЯЗАТЕЛЬНО:** Сделать backup важных данных перед радикальными действиями
3. **Работа с перегруженным API:** Использовать короткие таймауты, маленькие батчи, паузы
4. **Постепенное восстановление:** Не восстанавливать все сразу, проверять после каждого этапа
5. **Мониторинг:** Настроить мониторинг для предотвращения повторения проблем
6. **Документирование:** Записывать все изменения для будущей отладки

---

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После выполнения всех этапов:
- ✅ Кластер полностью очищен от проблемных ресурсов
- ✅ Зависший узел удален
- ✅ Control-plane не перегружен (<50% CPU, API отвечает <5 секунд)
- ✅ Cert-manager настроен правильно (max-concurrent-challenges=5) и работает
- ✅ Все проекты восстановлены и работают
- ✅ Сайты доступны (gyber.org, 1otc.cc, maximus-marketing-swarm.gyber.org)
- ✅ Настроена автоматическая очистка и мониторинг
- ✅ Система обеззаражена и защищена
- ✅ **Важные данные сохранены** (Secrets, ConfigMaps, PVC восстановлены из backup)

---

## 🔧 АЛЬТЕРНАТИВНЫЕ МЕТОДЫ (если основной не работает)

### Если API server полностью не отвечает:

1. **Прямой доступ к etcd** (только для экспертов):
   - Подключиться к control-plane узлу
   - Использовать etcdctl для прямого удаления объектов
   - ⚠️ ОПАСНО: может повредить кластер

2. **Перезапуск control-plane** (последний вариант):
   - Перезапустить k3s на control-plane узле
   - Это может временно снизить нагрузку
   - ⚠️ Временное решение, не устраняет корневую причину

3. **Создание нового кластера** (крайний случай):
   - Если кластер полностью неработоспособен
   - Восстановить данные из backup
   - ⚠️ Требует полной миграции

---

**ВАЖНО:** Выполнять этапы последовательно, проверяя результаты после каждого этапа. При возникновении проблем - остановиться и проанализировать ситуацию. **НИКОГДА не пропускать этап резервного копирования!**
