# 🔴 ЭКСПЕРТНЫЙ ПРОМПТ: ПОЛНОЕ ВОССТАНОВЛЕНИЕ K3S КЛАСТЕРА

> **Версия:** 4.0 | **Дата:** 18 января 2026 | **Автор:** Senior DevOps Engineer  
> **Статус:** КРИТИЧЕСКАЯ СИТУАЦИЯ — ТРЕБУЕТ НЕМЕДЛЕННОГО ВМЕШАТЕЛЬСТВА

---

## 📋 КОНТЕКСТ И ЦЕЛЬ

### Задача
Восстановить работоспособность K3s кластера и четырёх приоритетных продуктов:
1. **Techhy** — основной продукт
2. **1OTC** — OTC торговая платформа  
3. **DSP** — рекламная платформа
4. **Maximus** — бот-система

### Ограничения
- Сервер: 8GB RAM, 96GB диск
- Должен работать стабильно без ручного вмешательства
- Минимальное downtime для приоритетных сервисов

---

## 🔑 ДОСТУПЫ

```bash
# SSH к control-plane (tmedm)
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Ключ
~/.ssh/id_rsa_canton

# IP control-plane
31.129.105.180
```

---

## 📊 ДИАГНОСТИРОВАННАЯ КОРНЕВАЯ ПРИЧИНА

### 1. SQLite база K3s = 25GB (КРИТИЧНО!)

```
Файл: /var/lib/rancher/k3s/server/db/state.db
Размер: 25,057,595,392 bytes (25GB)
Записей: 4,911,995 (~5 миллионов)
```

**Почему это проблема:**
- k3s при старте загружает ВСЮ базу в память
- На 8GB сервере это вызывает OOM или бесконечный activating
- API server никогда не стартует

### 2. Топ загрязнителей базы (до очистки)

| Путь записи | Количество | Тип проблемы |
|-------------|------------|--------------|
| `/registry/ingress/default/dsp-prod-ingress` | **1,095,424** | Один ingress имеет 1M+ версий истории |
| `/registry/pods/develop-pswmeta` | 495,144 | Неиспользуемые поды pswmeta |
| `/registry/leases/kube-node-lease` | 456,512 | Leases (включая удалённые узлы) |
| `/registry/configmaps/istio-system` | 389,816 | **Удалённый namespace!** |
| `/registry/events/*` | 400,000+ | Старые events |
| `/registry/leases/istio-system` | 130,036 | **Удалённый namespace!** |
| `/registry/*/canton-node-65-108-15-30` | 90,485 | **Удалённый узел!** |
| `/registry/acme.cert-manager.io` | 43,137 | cert-manager challenges/orders |

### 3. Цепочка событий, приведшая к краху

```
1. cert-manager начал создавать ACME challenges
   ↓
2. Проблемы с DNS/Ingress → challenges не завершались
   ↓
3. cert-manager создал 23,000+ solver подов в istio-system
   ↓
4. Каждый под генерировал events, leases, replicasets
   ↓
5. kine (SQLite) сохранял ВСЕ версии всех объектов
   ↓
6. База выросла до 25GB
   ↓
7. k3s не может загрузить 25GB на 8GB RAM
   ↓
8. API server не стартует → kubectl не работает
   ↓
9. КЛАСТЕР НЕДОСТУПЕН
```

---

## ✅ ЧТО УЖЕ СДЕЛАНО

### Выполненные действия:
- [x] **Удалён namespace** `istio-system` (содержал 23K+ зомби подов)
- [x] **Удалён NotReady узел** `canton-node-65-108-15-30`
- [x] **Удалены challenges** cert-manager
- [x] **Остановлены deployments** при предыдущих сессиях
- [x] **Создан backup** базы: `state.db.backup.20260118_052908`
- [x] **Отключен автозапуск** k3s: `systemctl disable k3s`
- [x] **Установлен sqlite3** для работы с базой
- [x] **Запущена очистка базы** в screen (процесс `cleanup`)

### Текущий статус очистки базы:
```
✅ Удалены записи istio-system (~520K записей, 8 минут)
✅ Удалены записи canton-node-65-108-15-30 (~90K записей, 7 минут)
🔄 В процессе: удаление events (~400K записей, ~15-20 минут)
⏳ Ожидает: VACUUM (сжатие базы)
```

---

## 📋 ПОЛНЫЙ ПЛАН ВОССТАНОВЛЕНИЯ

### ЭТАП 1: ЗАВЕРШЕНИЕ ОЧИСТКИ БАЗЫ

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Проверить статус очистки
cat /tmp/cleanup.log
pgrep -a sqlite3 || echo "Cleanup finished"

# Если cleanup завершён, проверить результат
cd /var/lib/rancher/k3s/server/db
sqlite3 state.db "SELECT COUNT(*) FROM kine;"
# Ожидаемо: < 2,000,000 записей (было 4.9M)

ls -lh state.db
# Размер пока не изменится (нужен VACUUM)
```

### ЭТАП 2: VACUUM БАЗЫ (КРИТИЧНО!)

```bash
# VACUUM сожмёт базу и освободит место
cd /var/lib/rancher/k3s/server/db
sqlite3 state.db "VACUUM;"
# Займёт 5-15 минут

# Проверить результат
ls -lh state.db
# Ожидаемо: < 10GB (было 25GB)
```

### ЭТАП 3: ЗАПУСК K3S

```bash
# Включить автозапуск
systemctl enable k3s

# Запустить k3s
systemctl start k3s

# Мониторить логи
journalctl -f -u k3s &

# Ждать 2-3 минуты и проверить
sleep 180
ss -tlnp | grep 6443
# Должен быть LISTEN

systemctl status k3s
# Должен быть active (running)

kubectl get nodes --request-timeout=60s
# Должны показать узлы
```

### ЭТАП 4: НЕМЕДЛЕННАЯ СТАБИЛИЗАЦИЯ

**ВЫПОЛНИТЬ СРАЗУ ПОСЛЕ СТАРТА k3s!**

```bash
# Функция для безопасного scale
safe_scale() {
    kubectl scale deployment "$1" -n "$2" --replicas=0 --request-timeout=30s 2>/dev/null || echo "Skip: $1"
    sleep 1
}

# === 1. ОСТАНОВИТЬ CERT-MANAGER (ПЕРВЫМ!) ===
safe_scale cert-manager cert-manager
safe_scale cert-manager-cainjector cert-manager
safe_scale cert-manager-webhook cert-manager

# === 2. УДАЛИТЬ ОСТАВШИЙСЯ МУСОР CERT-MANAGER ===
kubectl delete challenges --all -A --timeout=60s 2>/dev/null || true
kubectl delete orders --all -A --timeout=60s 2>/dev/null || true
kubectl delete certificaterequests --all -A --timeout=60s 2>/dev/null || true

# === 3. ОСТАНОВИТЬ ВСЕ НЕПРИОРИТЕТНЫЕ DEPLOYMENTS ===

# supabase (НЕ НУЖЕН СЕЙЧАС)
kubectl scale deployment --all -n supabase --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n supabase-stage --replicas=0 --request-timeout=30s 2>/dev/null

# pswmeta (НЕ НУЖЕН)
kubectl scale deployment --all -n develop-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n stage-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n prod-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null

# external-secrets
kubectl scale deployment --all -n external-secrets --replicas=0 --request-timeout=30s 2>/dev/null

# gitlab
safe_scale gitlab gitlab

# coingecko
kubectl scale deployment --all -n coingecko-scanner --replicas=0 --request-timeout=30s 2>/dev/null

# cryptorecovery
safe_scale crypto-recovery-ai-bot cryptorecovery

# n8n
kubectl scale deployment --all -n develop-n8n --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n stage-n8n --replicas=0 --request-timeout=30s 2>/dev/null

# metallb
safe_scale controller metallb-system

echo "✅ Неприоритетные deployments остановлены"
```

### ЭТАП 5: ИСПРАВЛЕНИЕ TRAEFIK

```bash
# Проверить текущий статус
kubectl get deployment traefik -n kube-system -o yaml | grep -A5 nodeSelector

# Убрать nodeSelector (был привязан к удалённому узлу)
kubectl patch deployment traefik -n kube-system --type=json \
    -p '[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]' 2>/dev/null || \
    echo "nodeSelector not present"

# Если traefik остановлен - запустить
kubectl scale deployment traefik -n kube-system --replicas=1

# Ждать и проверить
sleep 60
kubectl get pods -n kube-system | grep traefik
# Должен быть 1/1 Running
```

### ЭТАП 6: ВОССТАНОВЛЕНИЕ CERT-MANAGER (С ЛИМИТАМИ!)

```bash
# Настроить лимиты для предотвращения будущих проблем
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=3",
    "--acme-http01-solver-pod-grace-period=30s"
  ]},
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "300m", "memory": "256Mi"},
    "requests": {"cpu": "50m", "memory": "64Mi"}
  }}
]' 2>/dev/null || echo "cert-manager patch may need adjustment"

# Запустить cert-manager по одному
kubectl scale deployment cert-manager -n cert-manager --replicas=1
sleep 30
kubectl get pods -n cert-manager

kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1
sleep 30

kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1
sleep 30

# Проверить все поды cert-manager
kubectl get pods -n cert-manager
# Все должны быть 1/1 Running
```

---

## 🚀 ВОССТАНОВЛЕНИЕ ПРИОРИТЕТНЫХ ПРОЕКТОВ

### 1. TECHHY

```bash
# Найти namespace
kubectl get namespaces | grep -i techhy
# Обычно: techhy-main-production

# Проверить состояние
kubectl get all -n techhy-main-production

# Запустить главный deployment (имя уточнить по get all)
kubectl scale deployment main-techhy-main-production -n techhy-main-production --replicas=1

# Ждать запуска
kubectl wait --for=condition=available deployment/main-techhy-main-production \
    -n techhy-main-production --timeout=180s

# Проверить работу
kubectl get pods -n techhy-main-production
curl -I https://techhy.cc 2>&1 | head -5
```

### 2. 1OTC (canton-otc)

```bash
# Проверить namespace
kubectl get all -n canton-otc

# Запустить
kubectl scale deployment canton-otc -n canton-otc --replicas=1

# Ждать
kubectl wait --for=condition=available deployment/canton-otc \
    -n canton-otc --timeout=180s

# Проверить
kubectl get pods -n canton-otc
curl -I https://1otc.cc 2>&1 | head -5
```

### 3. DSP

```bash
# В default namespace
kubectl get deployment -n default | grep dsp

# Запустить production
kubectl scale deployment dsp-prod-deployment-primary -n default --replicas=1

# Ждать
kubectl wait --for=condition=available deployment/dsp-prod-deployment-primary \
    -n default --timeout=180s

# Проверить
kubectl get pods -n default | grep dsp
```

### 4. MAXIMUS

```bash
# Сначала redis (зависимость)
kubectl scale deployment redis -n maximus --replicas=1
sleep 30
kubectl get pods -n maximus | grep redis
# Дождаться 1/1 Running

# Потом maximus
kubectl scale deployment maximus -n maximus --replicas=1

# Ждать
kubectl wait --for=condition=available deployment/maximus \
    -n maximus --timeout=180s

# Проверить
kubectl get pods -n maximus
```

---

## 🛡️ BEST PRACTICES: ПРЕДОТВРАЩЕНИЕ ПОВТОРЕНИЯ

### 1. Настройка Kine Compaction (SQLite)

K3s по умолчанию не компактирует базу. Добавить в `/etc/systemd/system/k3s.service.env`:

```bash
# Создать файл настроек
cat > /etc/systemd/system/k3s.service.env << 'EOF'
K3S_DATASTORE_ENDPOINT=
CATTLE_FEATURES="continuous-gc=true"
EOF

# Перезапустить k3s
systemctl daemon-reload
systemctl restart k3s
```

### 2. Настройка cert-manager для предотвращения спама

```yaml
# cert-manager-values.yaml или patch
apiVersion: v1
kind: ConfigMap
metadata:
  name: cert-manager-config
  namespace: cert-manager
data:
  # Лимиты на challenges
  max-concurrent-challenges: "3"
  # Таймаут solver подов
  acme-http01-solver-pod-grace-period: "30s"
```

### 3. Resource Quotas для namespaces

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: namespace-quota
  namespace: <namespace>
spec:
  hard:
    pods: "50"
    requests.cpu: "4"
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
```

### 4. Limit Ranges

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: <namespace>
spec:
  limits:
  - default:
      cpu: "500m"
      memory: "512Mi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
```

### 5. Регулярное обслуживание кластера

```bash
# Добавить в crontab
# Еженедельная очистка events старше 1 часа
0 3 * * 0 kubectl delete events --all -A --field-selector metadata.creationTimestamp<$(date -d '1 hour ago' -Iseconds)

# Мониторинг размера базы (алерт если > 5GB)
*/30 * * * * [ $(stat -c%s /var/lib/rancher/k3s/server/db/state.db) -gt 5368709120 ] && echo "ALERT: k3s db > 5GB" | mail -s "K3s Alert" admin@example.com
```

### 6. Переход на etcd (рекомендуется для production)

Если кластер критичен, рассмотреть переход с SQLite на etcd:

```bash
# При установке k3s указать внешний etcd
curl -sfL https://get.k3s.io | sh -s - server \
  --datastore-endpoint="https://etcd1:2379,https://etcd2:2379,https://etcd3:2379" \
  --datastore-cafile=/path/to/ca.crt \
  --datastore-certfile=/path/to/client.crt \
  --datastore-keyfile=/path/to/client.key
```

---

## 🔧 АВАРИЙНЫЕ КОМАНДЫ

### Если k3s снова завис:

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Полная остановка
systemctl stop k3s
pkill -9 k3s-server
pkill -9 k3s

# Убить все containerd-shim
pkill -9 containerd-shim

# Проверить
pgrep k3s || echo "k3s stopped"
fuser /var/lib/rancher/k3s/server/db/state.db 2>&1 || echo "DB free"
```

### Если база заблокирована:

```bash
fuser -k /var/lib/rancher/k3s/server/db/state.db
```

### РАДИКАЛЬНОЕ РЕШЕНИЕ (только в крайнем случае):

```bash
# ⚠️ ПОТЕРЯ ВСЕХ КОНФИГУРАЦИЙ!
cd /var/lib/rancher/k3s/server/db
mv state.db state.db.old.$(date +%Y%m%d_%H%M%S)
systemctl start k3s
# k3s создаст новую пустую базу
# Потребуется переприменить все манифесты
```

---

## 📊 ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

```bash
# === Система ===
uptime && free -h && df -h /

# === k3s ===
systemctl status k3s --no-pager
journalctl -u k3s -n 50 --no-pager

# === База данных ===
ls -lh /var/lib/rancher/k3s/server/db/state.db
sqlite3 /var/lib/rancher/k3s/server/db/state.db "SELECT COUNT(*) FROM kine;"

# === Топ загрязнителей ===
sqlite3 /var/lib/rancher/k3s/server/db/state.db \
  "SELECT SUBSTR(name, 1, 50) as path, COUNT(*) as cnt 
   FROM kine GROUP BY path HAVING cnt > 1000 
   ORDER BY cnt DESC LIMIT 20;"

# === После запуска k3s ===
kubectl get nodes
kubectl top nodes
kubectl get pods -A --field-selector status.phase=Pending --no-headers | wc -l
kubectl get deployments -A | grep -v "0/0\|1/1\|2/2\|3/3"
kubectl get challenges -A
kubectl get events -A --sort-by='.lastTimestamp' | tail -30
```

---

## 📋 ЧЕКЛИСТ ВОССТАНОВЛЕНИЯ

### Этап 1: База данных
- [ ] Очистка базы завершена (screen cleanup)
- [ ] VACUUM выполнен
- [ ] Размер базы < 10GB
- [ ] Количество записей < 2M

### Этап 2: k3s
- [ ] k3s запущен (systemctl status = active)
- [ ] API отвечает (port 6443 LISTEN)
- [ ] Все узлы Ready

### Этап 3: Стабилизация
- [ ] cert-manager остановлен
- [ ] Challenges/Orders/CertificateRequests удалены
- [ ] Неприоритетные deployments остановлены

### Этап 4: Инфраструктура
- [ ] Traefik работает (1/1 Running)
- [ ] cert-manager работает с лимитами

### Этап 5: Приоритетные проекты
- [ ] **Techhy** работает
- [ ] **1OTC** работает
- [ ] **DSP** работает
- [ ] **Maximus** работает

### Этап 6: Валидация
- [ ] Сайты доступны по HTTPS
- [ ] CPU кластера < 30%
- [ ] Memory кластера < 60%

---

## 📊 КАРТА NAMESPACES

| Namespace | Приоритет | Статус | Действие |
|-----------|-----------|--------|----------|
| techhy-main-production | 🔴 HIGH | Нужен | Восстановить |
| canton-otc | 🔴 HIGH | Нужен | Восстановить |
| maximus | 🔴 HIGH | Нужен | Восстановить |
| default (dsp) | 🔴 HIGH | Нужен | Восстановить |
| cert-manager | 🟡 MEDIUM | Критичен | С лимитами |
| kube-system | Системный | - | Только traefik |
| metallb-system | 🟡 MEDIUM | Может понадобиться | После traefik |
| supabase | 🟢 LOW | Не критичен | Оставить выключенным |
| supabase-stage | 🟢 LOW | Не нужен | Оставить выключенным |
| develop-pswmeta | ⚫ NONE | Не нужен | Оставить выключенным |
| stage-pswmeta | ⚫ NONE | Не нужен | Оставить выключенным |
| gitlab | 🟢 LOW | Не критичен | Оставить выключенным |
| coingecko-scanner | 🟢 LOW | Не критичен | Оставить выключенным |
| develop-n8n | 🟢 LOW | Не критичен | Оставить выключенным |
| stage-n8n | 🟢 LOW | Не критичен | Оставить выключенным |

---

## 🔍 МОНИТОРИНГ ПОСЛЕ ВОССТАНОВЛЕНИЯ

Команда для постоянного мониторинга:

```bash
watch -n 10 'echo "=== NODES ===" && kubectl top nodes 2>/dev/null && echo "" && echo "=== PROBLEM DEPLOYMENTS ===" && kubectl get deployments -A 2>/dev/null | grep -v "0/0\|1/1\|2/2\|3/3" | head -10 && echo "" && echo "=== PENDING PODS ===" && kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l | xargs echo "Count:"'
```

---

**Автор:** Senior DevOps Engineer  
**Версия:** 4.0 — ПОЛНАЯ ЭКСПЕРТИЗА С BEST PRACTICES  
**Дата:** 18 января 2026  
**Время создания:** UTC 03:15
