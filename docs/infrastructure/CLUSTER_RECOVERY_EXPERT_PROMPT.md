# 🚨 ЭКСПЕРТНЫЙ ПРОМПТ: ПОЛНОЕ ВОССТАНОВЛЕНИЕ K3S КЛАСТЕРА

**Дата создания:** 18 января 2026  
**Статус:** КРИТИЧЕСКАЯ СИТУАЦИЯ - ТРЕБУЕТ НЕМЕДЛЕННОГО ВМЕШАТЕЛЬСТВА  
**Приоритетные проекты:** techhy, 1otc, dsp, maximus

---

## 📊 ДИАГНОЗ ПРОБЛЕМЫ

### Корневая причина: SCHEDULER LOOP HELL + MEMORY EXHAUSTION

**Механизм проблемы:**
```
1. Множество deployments имеют DESIRED > READY
2. Scheduler постоянно пытается создать поды (100-300 ops/min)
3. cert-manager создал 23,000+ cm-acme-http-solver подов в istio-system
4. API server перегружается → 99% CPU
5. etcd и k3s-server потребляют всю память (6-7GB из 8GB)
6. Команды таймаутят, очистка не завершается
7. ЦИКЛ ПОВТОРЯЕТСЯ
```

### Состояние кластера:

| Узел | Роль | IP | Статус |
|------|------|-----|--------|
| tmedm | control-plane, master | 31.129.105.180 | Ready (перегружен) |
| kczdjomrqi | worker | - | Ready |
| upbewhtibq | worker | - | Ready |
| ~~canton-node-65-108-15-30~~ | - | - | **УДАЛЁН** |

### Критические метрики (до восстановления):
- CPU tmedm: **99%** → нужно <30%
- Load average: **96** → нужно <4
- Memory: **7.8GB/8GB** → нужно <5GB
- Pending подов: **23,000+** → нужно 0

---

## ✅ ЧТО УЖЕ СДЕЛАНО

1. ✅ **Удалён NotReady узел** `canton-node-65-108-15-30`
2. ✅ **Удалён namespace** `istio-system` (с 23K+ зомби подами)
3. ✅ **Остановлены deployments:**
   - cert-manager (все 3 компонента)
   - maximus, redis (в namespace maximus)
   - canton-otc-stage, canton-otc-minimal-stage
   - coingecko-scanner, stage-coingecko-scanner
   - crypto-recovery-ai-bot
   - develop-pswmeta (все deployments)
   - external-secrets (все)
   - gitlab
   - grafana, kiali, prometheus (istio-system - удалён)
   - metallb controller
   - stage-pswmeta (все)
   - supabase, supabase-stage (все)
   - auradomus, dsp-prod, dsp-stage, multi-swarm (default ns)
4. ✅ **Удалены cert-manager ресурсы:** Challenges, Orders, CertificateRequests
5. ✅ **Отключены CronJobs:** n8n-backup (develop-n8n, stage-n8n)
6. ✅ **k3s перезапущен** (но снова перегрузился)

---

## ❌ НЕРЕШЁННЫЕ ПРОБЛЕМЫ

1. **k3s-server потребляет 6GB RAM** - нужен рестарт с очисткой
2. **Traefik не запускается** - был привязан к удалённому узлу (nodeSelector)
3. **Scheduler loop** - deployments создают новые pending поды
4. **cert-manager** - не запущен, сертификаты не обновляются

---

## 🔑 SSH ДОСТУП

```bash
# Control-plane (tmedm)
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Ключ
~/.ssh/id_rsa_canton
```

---

## 🛠️ ПЛАН ВОССТАНОВЛЕНИЯ (ПОШАГОВЫЙ)

### ЭТАП 0: СТАБИЛИЗАЦИЯ CONTROL-PLANE

```bash
# Подключиться к control-plane
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Проверить состояние
top -b -n1 | head -10
free -h
systemctl status k3s

# Если k3s перегружен (CPU >80%, RAM >6GB):
systemctl stop k3s
sleep 10

# Очистить containerd кэш (опционально)
crictl rmi --prune 2>/dev/null || true

# Запустить k3s
systemctl start k3s

# Дождаться старта (2-3 минуты)
sleep 180

# Проверить
systemctl status k3s
kubectl get nodes
```

### ЭТАП 1: НЕМЕДЛЕННАЯ ОСТАНОВКА ВСЕХ ПРОБЛЕМНЫХ DEPLOYMENTS

**КРИТИЧНО: Выполнить СРАЗУ после старта k3s, пока CPU низкий!**

```bash
# Функция для безопасного scale
safe_scale() {
    kubectl scale deployment "$1" -n "$2" --replicas=0 --request-timeout=30s 2>/dev/null || echo "Skip: $1"
    sleep 1
}

# === ОСТАНОВИТЬ ВСЁ ===

# cert-manager
safe_scale cert-manager cert-manager
safe_scale cert-manager-cainjector cert-manager
safe_scale cert-manager-webhook cert-manager

# maximus namespace
safe_scale maximus maximus
safe_scale redis maximus

# canton-otc проекты
safe_scale canton-otc canton-otc
safe_scale canton-otc canton-otc-stage
safe_scale canton-otc canton-otc-minimal-stage

# default namespace
safe_scale auradomus-deployment default
safe_scale dsp-prod-deployment-primary default
safe_scale dsp-stage-deployment default
safe_scale multi-swarm-system-prod default

# supabase
kubectl scale deployment --all -n supabase --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n supabase-stage --replicas=0 --request-timeout=30s 2>/dev/null

# pswmeta
kubectl scale deployment --all -n develop-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n stage-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n prod-pswmeta --replicas=0 --request-timeout=30s 2>/dev/null

# external-secrets
kubectl scale deployment --all -n external-secrets --replicas=0 --request-timeout=30s 2>/dev/null
kubectl scale deployment --all -n external-secrets-system --replicas=0 --request-timeout=30s 2>/dev/null

# gitlab
safe_scale gitlab gitlab

# coingecko
safe_scale coingecko-scanner-bot coingecko-scanner
safe_scale stage-coingecko-scanner-bot coingecko-scanner

# cryptorecovery
safe_scale crypto-recovery-ai-bot cryptorecovery

# traefik (временно)
safe_scale traefik kube-system

# metallb
safe_scale controller metallb-system

echo "✅ Все deployments остановлены"
```

### ЭТАП 2: ОЧИСТКА PENDING ПОДОВ

```bash
# Удалить все Pending поды
kubectl get pods -A --field-selector status.phase=Pending -o json 2>/dev/null | \
    jq -r '.items[] | "\(.metadata.namespace)|\(.metadata.name)"' | \
    head -500 | \
    while IFS='|' read ns name; do
        kubectl delete pod "$name" -n "$ns" --grace-period=0 --force --request-timeout=5s 2>/dev/null &
    done
wait

# Проверить
kubectl get pods -A --field-selector status.phase=Pending --no-headers 2>/dev/null | wc -l
```

### ЭТАП 3: ОЧИСТКА TERMINATING NAMESPACE'ОВ

```bash
# Проверить застрявшие namespaces
kubectl get namespaces | grep Terminating

# Для каждого застрявшего namespace:
# kubectl get namespace <NAME> -o json | jq '.spec.finalizers = []' | \
#     kubectl replace --raw "/api/v1/namespaces/<NAME>/finalize" -f -
```

### ЭТАП 4: ПРОВЕРКА СТАБИЛИЗАЦИИ

```bash
# Проверить CPU и память
kubectl top nodes

# Ожидаемый результат:
# tmedm: CPU < 30%, Memory < 60%

# Если CPU > 50% - вернуться к ЭТАПУ 1 и найти что создаёт нагрузку:
kubectl get deployments -A | grep -v "0/0\|1/1\|2/2\|3/3"
```

### ЭТАП 5: ИСПРАВЛЕНИЕ TRAEFIK

**Проблема:** Traefik был привязан к удалённому узлу через nodeSelector.

```bash
# Убрать nodeSelector
kubectl patch deployment traefik -n kube-system --type=json \
    -p '[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]' 2>/dev/null || \
    echo "nodeSelector already removed"

# Перезапустить deployment
kubectl rollout restart deployment traefik -n kube-system

# Подождать
sleep 60

# Проверить
kubectl get pods -n kube-system | grep traefik
kubectl get deployment traefik -n kube-system

# Должен быть 1/1 Running
```

### ЭТАП 6: ВОССТАНОВЛЕНИЕ CERT-MANAGER (С ЛИМИТАМИ!)

```bash
# Настроить лимиты для cert-manager
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=3",
    "--acme-http01-solver-pod-grace-period=30s",
    "--enable-certificate-owner-ref=true"
  ]},
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "300m", "memory": "256Mi"},
    "requests": {"cpu": "50m", "memory": "64Mi"}
  }}
]' 2>/dev/null || echo "cert-manager patch failed"

# Запустить по одному
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

### 1. 1OTC (canton-otc)

```bash
# Проверить namespace
kubectl get all -n canton-otc

# Запустить с 1 репликой
kubectl scale deployment canton-otc -n canton-otc --replicas=1

# Дождаться запуска
kubectl wait --for=condition=available deployment/canton-otc -n canton-otc --timeout=180s

# Проверить
kubectl get pods -n canton-otc
curl -I https://1otc.cc 2>&1 | head -5
```

### 2. TECHHY

```bash
# Найти namespace и deployment
kubectl get namespaces | grep -i techhy
kubectl get deployments -A | grep -i techhy

# Запустить (пример - уточнить namespace/deployment)
# kubectl scale deployment techhy -n techhy --replicas=1

# Проверить
curl -I https://techhy.cc 2>&1 | head -5
```

### 3. DSP

```bash
# Проверить deployments в default namespace
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
4. **После каждого запуска проверять CPU** (`kubectl top nodes`)
5. **Если CPU > 70% - остановить и ждать**
6. **НИКОГДА не запускать kubectl get pods -A без таймаута при перегрузке**

---

## 🔧 АВАРИЙНЫЕ КОМАНДЫ

### Если кластер снова перегрузился:

```bash
# SSH на control-plane
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Рестарт k3s
systemctl restart k3s

# Или жёсткий kill если не отвечает
pkill -9 k3s-server
sleep 5
systemctl start k3s
```

### Если API не отвечает:

```bash
# Выполнить локально на control-plane через SSH
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 "kubectl get nodes"
```

---

## 📋 ЧЕКЛИСТ ВОССТАНОВЛЕНИЯ

- [ ] k3s стабилен (CPU < 30%, RAM < 60%)
- [ ] Все проблемные deployments остановлены
- [ ] Pending подов = 0
- [ ] Traefik работает (1/1 Running)
- [ ] cert-manager работает с лимитами
- [ ] **1OTC** работает
- [ ] **Techhy** работает
- [ ] **DSP** работает
- [ ] **Maximus** работает
- [ ] Сайты доступны по HTTPS

---

## 📊 ИНФОРМАЦИЯ О NAMESPACES

| Namespace | Статус | Действие |
|-----------|--------|----------|
| canton-otc | Нужен | Восстановить |
| maximus | Нужен | Восстановить |
| default (dsp) | Нужен | Восстановить |
| techhy-* | Уточнить | Найти и восстановить |
| supabase | Не критичен | Оставить выключенным |
| supabase-stage | Не критичен | Оставить выключенным |
| istio-system | УДАЛЁН | Не восстанавливать |
| develop-pswmeta | Не нужен | Оставить выключенным |
| stage-pswmeta | Не нужен | Оставить выключенным |
| cert-manager | Критичен | Восстановить с лимитами |
| kube-system | Системный | Только traefik |

---

## 🔍 ПОЛЕЗНЫЕ ДИАГНОСТИЧЕСКИЕ КОМАНДЫ

```bash
# Состояние узлов
kubectl get nodes -o wide
kubectl top nodes

# Проблемные deployments
kubectl get deployments -A | grep -v "0/0\|1/1\|2/2\|3/3"

# Pending поды
kubectl get pods -A --field-selector status.phase=Pending --no-headers | wc -l

# События
kubectl get events -A --sort-by='.lastTimestamp' | tail -30

# Challenges cert-manager
kubectl get challenges -A

# Ingress
kubectl get ingress -A

# Сертификаты
kubectl get certificates -A
```

---

**Автор:** AI DevOps Expert  
**Версия:** 2.0 - ПОЛНАЯ ЭКСПЕРТИЗА  
**Дата:** 18 января 2026
