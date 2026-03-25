# 🚨 ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ КЛАСТЕРА K3S

## ⚠️ КРИТИЧЕСКАЯ СИТУАЦИЯ - ДИАГНОЗ ПОДТВЕРЖДЁН

**Дата анализа:** 18 января 2026  
**Продолжительность проблемы:** ~13 дней (с 5 января 2026)  
**Статус:** ТРЕБУЕТ НЕМЕДЛЕННОГО ВМЕШАТЕЛЬСТВА

---

## 📊 ТОЧНЫЙ ДИАГНОЗ

### Состояние кластера:
| Узел | Статус | CPU | Проблема |
|------|--------|-----|----------|
| tmedm (control-plane) | Ready | **99%** | API отвечает 15-60 секунд |
| kczdjomrqi | Ready | 6% | OK |
| upbewhtibq | Ready | 3% | OK |
| canton-node-65-108-15-30 | **NotReady** | unknown | Недоступен 3+ дня |

### 🔥 КОРНЕВАЯ ПРИЧИНА: SCHEDULER LOOP HELL

**НЕ АТАКА! Это self-inflicted DDoS от собственных контроллеров.**

**Механизм:**
1. **30+ deployments** имеют DESIRED > READY (хотят больше подов чем есть)
2. Каждый deployment создаёт **Pending поды**
3. **Scheduler** пытается запланировать каждый под каждые 10-30 сек
4. Каждая попытка = **API request + etcd write (event)**
5. ~100-300 операций в минуту только от scheduler
6. **API server перегружен** на 99% CPU
7. Команды таймаутят, очистка не завершается
8. **Цикл повторяется бесконечно**

### Критические проблемы:

| Компонент | Статус | Влияние |
|-----------|--------|---------|
| traefik | **0/1** | INGRESS НЕ РАБОТАЕТ - сайты недоступны |
| istiod | 0/1 | Service mesh не работает |
| metallb controller | 0/1 | LoadBalancer не работает |
| maximus namespace | ~44 Pending подов | Постоянная нагрузка на scheduler |
| cert-manager | остановлен | Сертификаты не обновляются |
| canton-node-65-108-15-30 | NotReady | Генерирует events каждые 20 сек |

### Почему не могли восстановить неделю:
```
УДАЛИЛИ Pending поды
    ↓
Deployments СОЗДАЛИ новые Pending поды
    ↓
Scheduler loop ВОЗОБНОВИЛСЯ
    ↓
API server ПЕРЕГРУЖЕН снова
    ↓
REPEAT ♻️
```

---

## 🎯 СТРАТЕГИЯ ВОССТАНОВЛЕНИЯ

### КЛЮЧЕВОЙ ПРИНЦИП:
**СНАЧАЛА ОСТАНОВИТЬ ИСТОЧНИК, ПОТОМ ОЧИЩАТЬ!**

### Порядок действий:
1. ⛔ ОСТАНОВИТЬ все проблемные deployments (scale to 0)
2. 🗑️ УДАЛИТЬ NotReady узел
3. 🧹 ОЧИСТИТЬ все Pending поды
4. ⏳ ДОЖДАТЬСЯ стабилизации API (<50% CPU)
5. 🔄 ВОССТАНОВИТЬ критичные сервисы по одному

---

## 🛠️ ЭТАП 1: ОСТАНОВКА ИСТОЧНИКОВ НАГРУЗКИ

### ⚠️ КРИТИЧЕСКИ ВАЖНО: ВСЕ КОМАНДЫ С БОЛЬШИМИ ТАЙМАУТАМИ!

```bash
# Установить alias для всех команд
alias k='kubectl --request-timeout=120s'

# Или использовать функцию
safe_kubectl() {
    kubectl --request-timeout=180s "$@"
}
```

### 1.1 Остановить cert-manager (если работает)
```bash
kubectl scale deployment cert-manager -n cert-manager --replicas=0 --request-timeout=60s 2>/dev/null || echo "Already stopped"
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=0 --request-timeout=60s 2>/dev/null || echo "Already stopped"
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=0 --request-timeout=60s 2>/dev/null || echo "Already stopped"
```

### 1.2 Остановить ВСЕ проблемные deployments в maximus
```bash
# Остановить maximus и redis - главные источники Pending подов
kubectl scale deployment maximus -n maximus --replicas=0 --request-timeout=60s
kubectl scale deployment redis -n maximus --replicas=0 --request-timeout=60s
```

### 1.3 Остановить другие проблемные deployments
```bash
# Список проблемных deployments (DESIRED > READY)
# Выполнять по одному с паузами 5 секунд между командами

kubectl scale deployment canton-otc -n canton-otc-minimal-stage --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment canton-otc -n canton-otc-stage --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment coingecko-scanner-bot -n coingecko-scanner --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment stage-coingecko-scanner-bot -n coingecko-scanner --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment crypto-recovery-ai-bot -n cryptorecovery --replicas=0 --request-timeout=60s
sleep 5

# develop-pswmeta - все deployments
kubectl scale deployment --all -n develop-pswmeta --replicas=0 --request-timeout=60s
sleep 5

# external-secrets
kubectl scale deployment --all -n external-secrets-system --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment --all -n external-secrets --replicas=0 --request-timeout=60s
sleep 5

# gitlab
kubectl scale deployment gitlab -n gitlab --replicas=0 --request-timeout=60s
sleep 5

# istio-system (НЕ ТРОГАТЬ istiod если нужен service mesh)
kubectl scale deployment grafana -n istio-system --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment kiali -n istio-system --replicas=0 --request-timeout=60s
sleep 5
kubectl scale deployment prometheus -n istio-system --replicas=0 --request-timeout=60s
sleep 5

# metallb
kubectl scale deployment controller -n metallb-system --replicas=0 --request-timeout=60s
sleep 5

# stage-pswmeta
kubectl scale deployment --all -n stage-pswmeta --replicas=0 --request-timeout=60s
```

### 1.4 Проверить что deployments остановлены
```bash
echo "Проверка остановленных deployments..."
kubectl get deployments -A --request-timeout=120s 2>&1 | grep -v "0/0\|1/1\|2/2\|3/3" | head -20
```

---

## 🛠️ ЭТАП 2: УДАЛЕНИЕ NOTREADY УЗЛА

### 2.1 Удалить все поды с узла (очистить finalizers)
```bash
STUCK_NODE="canton-node-65-108-15-30"

echo "Удаление подов с узла $STUCK_NODE..."

# Получить и удалить поды по одному
kubectl get pods -A -o json --request-timeout=180s 2>/dev/null | \
    jq -r --arg node "$STUCK_NODE" '.items[] | select(.spec.nodeName==$node) | "\(.metadata.namespace)|\(.metadata.name)"' | \
    head -50 | \
    while IFS='|' read -r ns name; do
        [ -z "$ns" ] || [ -z "$name" ] && continue
        echo "  Удаление $ns/$name"
        
        # Очистить finalizers
        kubectl patch pod "$name" -n "$ns" -p '{"metadata":{"finalizers":[]}}' --type=merge --request-timeout=10s 2>/dev/null || true
        
        # Удалить под
        kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --request-timeout=10s 2>/dev/null || true
        
        sleep 0.5
    done

echo "✅ Поды с узла удалены"
```

### 2.2 Удалить узел из кластера
```bash
STUCK_NODE="canton-node-65-108-15-30"

echo "Удаление узла $STUCK_NODE..."
kubectl delete node "$STUCK_NODE" --request-timeout=60s 2>/dev/null || echo "Узел возможно уже удален"

# Проверить
sleep 5
kubectl get nodes --request-timeout=60s
```

---

## 🛠️ ЭТАП 3: ОЧИСТКА PENDING ПОДОВ

### 3.1 Удалить все cert-manager ресурсы
```bash
echo "=== Удаление Challenges ==="
kubectl delete challenges --all -A --request-timeout=120s 2>/dev/null || echo "Done or error"

echo "=== Удаление CertificateRequests ==="
kubectl delete certificaterequests --all -A --request-timeout=120s 2>/dev/null || echo "Done or error"

echo "=== Удаление Orders ==="
kubectl delete orders --all -A --request-timeout=120s 2>/dev/null || echo "Done or error"
```

### 3.2 Удалить Pending поды по namespace (с паузами)
```bash
# Список проблемных namespaces
NAMESPACES=(
    "maximus"
    "kube-system"
    "develop-pswmeta"
    "stage-pswmeta"
    "prod-pswmeta"
    "canton-otc"
    "canton-otc-stage"
    "canton-otc-minimal-stage"
    "istio-system"
    "default"
)

for ns in "${NAMESPACES[@]}"; do
    echo "=== Очистка namespace: $ns ==="
    
    # Получить Pending поды
    kubectl get pods -n "$ns" --field-selector status.phase=Pending -o name --request-timeout=60s 2>/dev/null | \
        head -50 | \
        while read pod; do
            [ -z "$pod" ] && continue
            kubectl delete "$pod" -n "$ns" --grace-period=0 --force --request-timeout=10s 2>/dev/null || true
            sleep 0.2
        done
    
    echo "✅ $ns очищен"
    sleep 3  # Пауза между namespaces
done
```

### 3.3 Удалить challenge solver поды
```bash
echo "=== Удаление cm-acme-http-solver подов ==="
kubectl get pods -A -o name --request-timeout=120s 2>/dev/null | \
    grep "cm-acme-http-solver" | \
    head -100 | \
    while read pod; do
        ns=$(echo "$pod" | cut -d'/' -f1)
        kubectl delete "$pod" --grace-period=0 --force --request-timeout=10s 2>/dev/null || true
        sleep 0.1
    done
```

### 3.4 Удалить зависшие svclb поды в kube-system
```bash
echo "=== Удаление Pending svclb подов ==="
kubectl get pods -n kube-system --field-selector status.phase=Pending -o name --request-timeout=60s 2>/dev/null | \
    while read pod; do
        [ -z "$pod" ] && continue
        kubectl delete "$pod" -n kube-system --grace-period=0 --force --request-timeout=10s 2>/dev/null || true
        sleep 0.2
    done
```

---

## 🛠️ ЭТАП 4: ОЖИДАНИЕ СТАБИЛИЗАЦИИ

### 4.1 Проверить нагрузку на control-plane
```bash
echo "=== Проверка CPU ==="
kubectl top nodes --request-timeout=60s 2>&1

# Ожидаемый результат: tmedm CPU < 50%
```

### 4.2 Если CPU все еще высокий - повторить очистку
```bash
# Проверить что осталось
echo "=== Оставшиеся Pending поды ==="
kubectl get pods -A --field-selector status.phase=Pending --request-timeout=120s 2>&1 | head -30

# Если много - повторить ЭТАП 3
```

### 4.3 Дождаться стабилизации (5-10 минут)
```bash
echo "Ожидание стабилизации API server..."
for i in {1..10}; do
    CPU=$(kubectl top node tmedm --no-headers --request-timeout=30s 2>/dev/null | awk '{print $3}' || echo "N/A")
    echo "[$i/10] CPU tmedm: $CPU"
    
    if [[ "$CPU" =~ ^[0-9]+% ]] && [ "${CPU%\%}" -lt 50 ]; then
        echo "✅ CPU стабилизировался!"
        break
    fi
    
    sleep 60
done
```

---

## 🛠️ ЭТАП 5: ВОССТАНОВЛЕНИЕ КРИТИЧНЫХ СЕРВИСОВ

### ⚠️ ВАЖНО: Восстанавливать ПО ОДНОМУ с проверками!

### 5.1 Восстановить Traefik (КРИТИЧНО - без него нет ingress)
```bash
echo "=== Восстановление Traefik ==="
kubectl scale deployment traefik -n kube-system --replicas=1 --request-timeout=60s

# Дождаться запуска
echo "Ожидание запуска traefik..."
kubectl wait --for=condition=available deployment/traefik -n kube-system --timeout=180s 2>/dev/null || \
    echo "Таймаут - проверить вручную"

# Проверить
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik --request-timeout=60s
```

### 5.2 Проверить CoreDNS (должен уже работать)
```bash
echo "=== Проверка CoreDNS ==="
kubectl get pods -n kube-system -l k8s-app=kube-dns --request-timeout=60s
```

### 5.3 Восстановить cert-manager с правильной конфигурацией
```bash
echo "=== Настройка cert-manager ==="

# Применить правильные настройки (max-concurrent-challenges=5)
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=5",
    "--acme-http01-solver-pod-grace-period=1m",
    "--enable-certificate-owner-ref=true"
  ]}
]' --request-timeout=60s 2>/dev/null || echo "Patch failed - may already be configured"

# Установить лимиты ресурсов
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "500m", "memory": "512Mi"},
    "requests": {"cpu": "100m", "memory": "128Mi"}
  }}
]' --request-timeout=60s 2>/dev/null || echo "Limits already set"

# Запустить
kubectl scale deployment cert-manager -n cert-manager --replicas=1 --request-timeout=60s
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1 --request-timeout=60s
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1 --request-timeout=60s

# Дождаться
echo "Ожидание cert-manager..."
kubectl wait --for=condition=available deployment/cert-manager -n cert-manager --timeout=180s 2>/dev/null || echo "Timeout"

# Проверить
kubectl get pods -n cert-manager --request-timeout=60s
```

### 5.4 Восстановить основной проект canton-otc
```bash
echo "=== Восстановление canton-otc ==="

# Проверить текущее состояние
kubectl get deployment canton-otc -n canton-otc --request-timeout=60s

# Если replicas=2 - уменьшить до 1 для начала
kubectl scale deployment canton-otc -n canton-otc --replicas=1 --request-timeout=60s

# Дождаться
kubectl wait --for=condition=available deployment/canton-otc -n canton-otc --timeout=180s 2>/dev/null || echo "Timeout"

# Проверить
kubectl get pods -n canton-otc --request-timeout=60s
```

### 5.5 Опционально - восстановить maximus (если нужен)
```bash
echo "=== Восстановление maximus ==="

# Сначала только redis
kubectl scale deployment redis -n maximus --replicas=1 --request-timeout=60s
sleep 30

# Проверить redis
kubectl get pods -n maximus -l app=redis --request-timeout=60s

# Потом maximus
kubectl scale deployment maximus -n maximus --replicas=1 --request-timeout=60s

# Проверить
kubectl get pods -n maximus --request-timeout=60s
```

---

## 🛠️ ЭТАП 6: ФИНАЛЬНАЯ ПРОВЕРКА

### 6.1 Проверить состояние кластера
```bash
echo "=== ФИНАЛЬНАЯ ПРОВЕРКА ==="

echo "Узлы:"
kubectl get nodes --request-timeout=60s

echo ""
echo "CPU:"
kubectl top nodes --request-timeout=60s

echo ""
echo "Pending поды:"
kubectl get pods -A --field-selector status.phase=Pending --no-headers --request-timeout=120s 2>/dev/null | wc -l | xargs echo "Count:"

echo ""
echo "Challenges:"
kubectl get challenges -A --no-headers --request-timeout=60s 2>/dev/null | wc -l | xargs echo "Count:"

echo ""
echo "Критичные сервисы:"
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik --request-timeout=60s
kubectl get pods -n cert-manager --request-timeout=60s
kubectl get pods -n canton-otc --request-timeout=60s
```

### 6.2 Проверить доступность сайтов
```bash
echo "=== Проверка доступности ==="
curl -I -m 10 https://gyber.org 2>&1 | head -3 || echo "gyber.org недоступен"
curl -I -m 10 https://1otc.cc 2>&1 | head -3 || echo "1otc.cc недоступен"
```

---

## ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После выполнения всех этапов:

| Метрика | До | После |
|---------|-----|-------|
| CPU tmedm | 99% | < 30% |
| API response time | 15-60 сек | < 5 сек |
| Pending подов | 100+ | < 10 |
| Traefik | 0/1 | 1/1 |
| Challenges | 10+ | 0 |
| Сайты | Недоступны | Доступны |

---

## ⚠️ ВАЖНЫЕ ПРЕДУПРЕЖДЕНИЯ

1. **ВСЕ команды с --request-timeout=60s минимум!** API отвечает медленно.

2. **НИКОГДА не запускать:** `kubectl get pods -A` без таймаута - это убьёт API server

3. **Паузы между командами обязательны** - дать API server обработать запросы

4. **Восстанавливать сервисы ПО ОДНОМУ** - не всё сразу

5. **Проверять CPU после каждого этапа** - если > 70% - остановиться и ждать

6. **Если что-то пошло не так** - scale deployment --replicas=0 и повторить очистку

---

## 🔧 КОМАНДЫ ДЛЯ ЭКСТРЕННОГО ОТКАТА

Если ситуация ухудшилась:

```bash
# Остановить ВСЁ что только что запустили
kubectl scale deployment traefik -n kube-system --replicas=0 --request-timeout=60s
kubectl scale deployment cert-manager -n cert-manager --replicas=0 --request-timeout=60s
kubectl scale deployment canton-otc -n canton-otc --replicas=0 --request-timeout=60s
kubectl scale deployment maximus -n maximus --replicas=0 --request-timeout=60s
kubectl scale deployment redis -n maximus --replicas=0 --request-timeout=60s

# Подождать 5 минут
sleep 300

# Проверить CPU
kubectl top nodes --request-timeout=60s
```

---

## 📋 ЧЕКЛИСТ

- [ ] ЭТАП 1: Все проблемные deployments остановлены (replicas=0)
- [ ] ЭТАП 2: Узел canton-node-65-108-15-30 удалён
- [ ] ЭТАП 3: Все Pending поды удалены
- [ ] ЭТАП 4: CPU tmedm < 50%
- [ ] ЭТАП 5.1: Traefik работает (1/1)
- [ ] ЭТАП 5.2: CoreDNS работает
- [ ] ЭТАП 5.3: Cert-manager работает с max-concurrent-challenges=5
- [ ] ЭТАП 5.4: canton-otc работает
- [ ] ЭТАП 6: Сайты доступны

---

**Автор:** AI DevOps Analysis  
**Дата:** 18 января 2026  
**Версия:** 1.0 - ФИНАЛЬНЫЙ ПРОМПТ
