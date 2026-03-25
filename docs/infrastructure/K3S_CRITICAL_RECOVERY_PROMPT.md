# 🔴 КРИТИЧЕСКИЙ ПРОМПТ: ПОЛНОЕ ВОССТАНОВЛЕНИЕ K3S КЛАСТЕРА

**Дата:** 18 января 2026  
**Статус:** КРИТИЧЕСКАЯ СИТУАЦИЯ - БАЗА ДАННЫХ 25GB  
**Приоритетные проекты:** techhy, 1otc, dsp, maximus

---

## 📊 ДИАГНОСТИРОВАННАЯ КОРНЕВАЯ ПРИЧИНА

### SQLite база K3s = 25GB (КРИТИЧНО!)

```
/var/lib/rancher/k3s/server/db/state.db = 25,057,595,392 bytes (25GB!)
Записей в таблице kine: 4,911,995 (почти 5 миллионов!)
```

### Топ загрязнителей базы:

| Путь записи | Количество | Проблема |
|-------------|------------|----------|
| `/registry/ingress/default/dsp-prod-ingress` | **1,095,424** | Один ingress имеет 1M+ версий |
| `/registry/pods/develop-pswmeta` | 495,144 | Старые поды pswmeta |
| `/registry/leases/kube-node-lease` | 456,512 | Leases всех узлов |
| `/registry/configmaps/istio-system` | 389,816 | **УДАЛЁННЫЙ namespace!** |
| `/registry/replicasets/develop-pswmeta` | 240,038 | Старые replicasets |
| `/registry/deployments/develop-pswmeta` | 239,524 | Исторические deployments |
| `/registry/leases/kube-system/cert-manager` | 179,829 | cert-manager leases |
| `/registry/leases/istio-system` | 130,036 | **УДАЛЁННЫЙ namespace!** |
| `/registry/leases/kube-node-lease/canton-node-65-108-15-30` | 90,485 | **УДАЛЁННЫЙ УЗЕЛ!** |
| `/registry/acme.cert-manager.io` | 43,137 | cert-manager challenges/orders |

### Почему k3s зависает:
1. k3s пытается загрузить 25GB базу в память
2. После "Database tables and indexes are up to date" - зависает
3. API server (порт 6443) никогда не стартует
4. Systemd status остаётся "activating" бесконечно

---

## 🔑 ДОСТУПЫ

```bash
# SSH к control-plane (tmedm)
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Ключ
~/.ssh/id_rsa_canton
```

---

## 📋 ТЕКУЩЕЕ СОСТОЯНИЕ КЛАСТЕРА

### Узлы:
| Узел | Роль | IP | Статус |
|------|------|-----|--------|
| tmedm | control-plane, master | 31.129.105.180 | k3s не стартует |
| kczdjomrqi | worker | - | Не подключен |
| upbewhtibq | worker | - | Не подключен |
| ~~canton-node-65-108-15-30~~ | - | - | **УДАЛЁН** |

### Ресурсы tmedm (СТАБИЛИЗИРОВАЛИСЬ):
- CPU: ~2-10% idle 70%+ ✅
- Load average: ~1.0 ✅
- Memory: 1.7GB used / 7.8GB total, 6GB available ✅
- Disk: 45GB used / 96GB (47%), свободно 52GB ✅

### Что уже сделано:
- ✅ Удалён namespace istio-system (23K+ зомби подов)
- ✅ Удалены challenges cert-manager
- ✅ Остановлены проблемные deployments (при предыдущих сессиях)
- ✅ Удалён NotReady узел canton-node-65-108-15-30
- ✅ Создан backup state.db: `/var/lib/rancher/k3s/server/db/state.db.backup.20260118_052908`
- ✅ Установлен sqlite3 для работы с базой

---

## 🛠️ ПЛАН ВОССТАНОВЛЕНИЯ (ПОШАГОВЫЙ)

### ЭТАП 1: ОСТАНОВКА K3S И РАЗБЛОКИРОВКА БАЗЫ

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Полная остановка k3s
systemctl stop k3s
pkill -9 k3s-server
pkill -9 k3s

# Проверить что база разблокирована
fuser /var/lib/rancher/k3s/server/db/state.db 2>&1 || echo "DB unlocked"

# Если заблокирована - убить PID
# fuser -k /var/lib/rancher/k3s/server/db/state.db
```

### ЭТАП 2: ОЧИСТКА БАЗЫ ДАННЫХ (КРИТИЧНО!)

**Удаление мусора из SQLite:**

```bash
cd /var/lib/rancher/k3s/server/db

# 1. Удалить записи удалённого istio-system namespace
sqlite3 state.db "DELETE FROM kine WHERE name LIKE '%istio-system%';"

# 2. Удалить записи удалённого узла
sqlite3 state.db "DELETE FROM kine WHERE name LIKE '%canton-node-65-108-15-30%';"

# 3. Удалить старые события (events более 24 часов - они не нужны)
# События занимают много места
sqlite3 state.db "DELETE FROM kine WHERE name LIKE '/registry/events/%';"

# 4. Проверить оставшееся количество
sqlite3 state.db "SELECT COUNT(*) FROM kine;"
# Должно стать значительно меньше 5M

# 5. VACUUM для сжатия базы (ВАЖНО!)
sqlite3 state.db "VACUUM;"

# 6. Проверить новый размер
ls -lh state.db
```

**Ожидаемый результат:**
- Было: 25GB, 4.9M записей
- Должно стать: <5GB, <1M записей

### ЭТАП 3: ЗАПУСК K3S

```bash
# Запустить k3s
systemctl start k3s

# Мониторить логи в реальном времени
journalctl -f -u k3s &

# Подождать 2-3 минуты, проверить порт
sleep 120
ss -tlnp | grep 6443

# Проверить статус
systemctl status k3s
kubectl get nodes --request-timeout=60s
```

### ЭТАП 4: НЕМЕДЛЕННАЯ ОСТАНОВКА ВСЕХ DEPLOYMENTS

**КРИТИЧНО: Выполнить СРАЗУ после старта k3s!**

```bash
# Функция для безопасного scale
safe_scale() {
    kubectl scale deployment "$1" -n "$2" --replicas=0 --request-timeout=30s 2>/dev/null || echo "Skip: $1"
    sleep 1
}

# === ОСТАНОВИТЬ ВСЁ ===

# cert-manager (ПЕРВЫМ!)
safe_scale cert-manager cert-manager
safe_scale cert-manager-cainjector cert-manager
safe_scale cert-manager-webhook cert-manager

# maximus namespace
safe_scale maximus maximus
safe_scale redis maximus

# canton-otc проекты
kubectl scale deployment --all -n canton-otc --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n canton-otc-stage --replicas=0 --request-timeout=30s 2>/dev/null

# default namespace
safe_scale auradomus-deployment default
safe_scale dsp-prod-deployment-primary default
safe_scale dsp-stage-deployment default
safe_scale multi-swarm-system-prod default

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

# traefik (временно)
safe_scale traefik kube-system

# metallb
safe_scale controller metallb-system

echo "✅ Все deployments остановлены"
```

### ЭТАП 5: ИСПРАВЛЕНИЕ TRAEFIK

```bash
# Убрать nodeSelector (был привязан к удалённому узлу)
kubectl patch deployment traefik -n kube-system --type=json \
    -p '[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]' 2>/dev/null || \
    echo "nodeSelector already removed or not exists"

# Запустить traefik
kubectl scale deployment traefik -n kube-system --replicas=1

# Подождать и проверить
sleep 60
kubectl get pods -n kube-system | grep traefik
```

### ЭТАП 6: ВОССТАНОВЛЕНИЕ CERT-MANAGER (С ЛИМИТАМИ!)

```bash
# Удалить все оставшиеся challenges, orders, certificaterequests
kubectl delete challenges --all -A --timeout=60s 2>/dev/null || true
kubectl delete orders --all -A --timeout=60s 2>/dev/null || true  
kubectl delete certificaterequests --all -A --timeout=60s 2>/dev/null || true

# Настроить лимиты для cert-manager
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=3"
  ]},
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "300m", "memory": "256Mi"},
    "requests": {"cpu": "50m", "memory": "64Mi"}
  }}
]' 2>/dev/null || echo "cert-manager patch failed or already applied"

# Запустить cert-manager по одному
kubectl scale deployment cert-manager -n cert-manager --replicas=1
sleep 30
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1
sleep 30
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1

# Проверить
kubectl get pods -n cert-manager
```

---

## 🚀 ВОССТАНОВЛЕНИЕ ПРИОРИТЕТНЫХ ПРОЕКТОВ

### 1. TECHHY

```bash
# Найти namespace
kubectl get namespaces | grep -i techhy

# Обычно: techhy-main-production
kubectl get all -n techhy-main-production

# Запустить главный deployment
kubectl scale deployment main-techhy-main-production -n techhy-main-production --replicas=1

# Проверить
kubectl get pods -n techhy-main-production
curl -I https://techhy.cc 2>&1 | head -5
```

### 2. 1OTC (canton-otc)

```bash
# Проверить namespace
kubectl get all -n canton-otc

# Запустить
kubectl scale deployment canton-otc -n canton-otc --replicas=1

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

# Проверить
kubectl get pods -n default | grep dsp
```

### 4. MAXIMUS

```bash
# Сначала redis
kubectl scale deployment redis -n maximus --replicas=1
sleep 30

# Проверить redis
kubectl get pods -n maximus | grep redis

# Потом maximus
kubectl scale deployment maximus -n maximus --replicas=1

# Проверить
kubectl get pods -n maximus
```

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

1. **ВСЕ kubectl команды с --request-timeout=30-60s**
2. **Паузы между командами обязательны** (sleep 2-5)
3. **Восстанавливать сервисы ПО ОДНОМУ**
4. **После каждого запуска проверять CPU**: `kubectl top nodes`
5. **Если CPU > 70% - остановить и ждать**
6. **VACUUM базы ОБЯЗАТЕЛЕН после удаления записей**

---

## 🔧 АВАРИЙНЫЕ КОМАНДЫ

### Если k3s снова завис:

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Принудительная остановка
systemctl stop k3s
pkill -9 k3s-server
pkill -9 k3s

# Убить все containerd-shim зомби
pkill -9 containerd-shim

# Проверить
pgrep k3s || echo "k3s stopped"
```

### Если база всё ещё заблокирована:

```bash
# Найти процесс
fuser /var/lib/rancher/k3s/server/db/state.db

# Убить
fuser -k /var/lib/rancher/k3s/server/db/state.db
```

### Если ничего не помогает - РАДИКАЛЬНОЕ РЕШЕНИЕ:

```bash
# ⚠️ ТОЛЬКО В КРАЙНЕМ СЛУЧАЕ - потеря всех конфигураций!
cd /var/lib/rancher/k3s/server/db
mv state.db state.db.old.$(date +%Y%m%d_%H%M%S)
systemctl start k3s
# k3s создаст новую пустую базу
# Потребуется переприменить все манифесты
```

---

## 📊 ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

```bash
# Состояние системы
uptime && free -h && df -h /

# k3s статус
systemctl status k3s --no-pager
journalctl -u k3s -n 30 --no-pager

# Размер базы
ls -lh /var/lib/rancher/k3s/server/db/state.db

# Количество записей
sqlite3 /var/lib/rancher/k3s/server/db/state.db "SELECT COUNT(*) FROM kine;"

# Топ загрязнителей
sqlite3 /var/lib/rancher/k3s/server/db/state.db \
  "SELECT SUBSTR(name, 1, 50), COUNT(*) as cnt FROM kine GROUP BY SUBSTR(name, 1, 50) HAVING cnt > 1000 ORDER BY cnt DESC LIMIT 20;"

# После запуска k3s:
kubectl get nodes
kubectl top nodes
kubectl get pods -A --field-selector status.phase=Pending --no-headers | wc -l
kubectl get deployments -A | grep -v "0/0\|1/1\|2/2\|3/3"
```

---

## 📋 ЧЕКЛИСТ ВОССТАНОВЛЕНИЯ

- [ ] k3s остановлен, база разблокирована
- [ ] Удалены записи istio-system из базы
- [ ] Удалены записи canton-node-65-108-15-30 из базы  
- [ ] Удалены старые events из базы
- [ ] VACUUM выполнен, база сжата
- [ ] База < 5GB
- [ ] k3s запущен и API отвечает
- [ ] Все deployments остановлены
- [ ] Traefik работает (1/1 Running)
- [ ] cert-manager работает с лимитами
- [ ] **Techhy** работает
- [ ] **1OTC** работает
- [ ] **DSP** работает  
- [ ] **Maximus** работает
- [ ] Сайты доступны по HTTPS

---

## 📊 NAMESPACES КАРТА

| Namespace | Нужен? | Действие |
|-----------|--------|----------|
| techhy-main-production | ✅ ДА | Восстановить |
| canton-otc | ✅ ДА | Восстановить |
| maximus | ✅ ДА | Восстановить |
| default (dsp) | ✅ ДА | Восстановить |
| cert-manager | ✅ ДА | С лимитами |
| kube-system | Системный | Только traefik |
| metallb-system | Может понадобиться | После traefik |
| supabase | ❌ Пока нет | Оставить выключенным |
| supabase-stage | ❌ Нет | Оставить выключенным |
| develop-pswmeta | ❌ Нет | Оставить выключенным |
| stage-pswmeta | ❌ Нет | Оставить выключенным |
| gitlab | ❌ Нет | Оставить выключенным |
| coingecko-scanner | ❌ Нет | Оставить выключенным |

---

**Автор:** AI DevOps Expert  
**Версия:** 3.0 - С ДИАГНОСТИКОЙ SQLITE  
**Дата:** 18 января 2026
