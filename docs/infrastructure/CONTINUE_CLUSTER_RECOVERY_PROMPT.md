# 🔧 ПРОМПТ ДЛЯ ПРОДОЛЖЕНИЯ ВОССТАНОВЛЕНИЯ КЛАСТЕРА K3S

## КОНТЕКСТ
Я продолжаю восстановление кластера Kubernetes (K3s), которое было начато в предыдущем чате. Проблема длится с 5 января 2026 года (~13 дней).

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ КЛАСТЕРА (на 18.01.2026)

### Узлы:
```
NAME         STATUS   ROLES                  AGE    VERSION
kczdjomrqi   Ready    worker                 201d   v1.31.5+k3s1
tmedm        Ready    control-plane,master   148d   v1.31.4+k3s1
upbewhtibq   Ready    <none>                 198d   v1.32.5+k3s1
```
✅ Проблемный узел `canton-node-65-108-15-30` был удалён

### Нагрузка:
```
NAME         CPU      MEMORY
kczdjomrqi   8%       41%
tmedm        99%      68%   ⚠️ КРИТИЧНО ВЫСОКАЯ!
upbewhtibq   3%       37%
```

### Критичные сервисы:
| Сервис | Статус | Проблема |
|--------|--------|----------|
| traefik | 0/1 | НЕ РАБОТАЕТ - сайты недоступны |
| cert-manager | 0/0 | Остановлен (правильно) |
| coredns | 1/1 | OK |

---

## 🔍 ДИАГНОЗ ПРОБЛЕМЫ

### Корневая причина: SCHEDULER LOOP HELL (Self-inflicted DDoS)

**Механизм:**
1. ~20+ deployments имеют DESIRED > READY
2. Kubernetes scheduler постоянно пытается создать недостающие поды
3. Каждая попытка = API request + etcd event
4. Это создаёт ~100-300 операций в минуту
5. Control-plane (tmedm) перегружен на 99% CPU
6. API server отвечает медленно (15-60 секунд)

### Почему проблема не решается:
- Удаление Pending подов не помогает - deployments создают новые
- Нужно сначала ОСТАНОВИТЬ deployments, потом очищать

---

## ✅ ЧТО УЖЕ СДЕЛАНО

### ЭТАП 1: Остановлены проблемные deployments ✅
- cert-manager (replicas=0)
- maximus, redis в namespace maximus
- canton-otc-minimal-stage, canton-otc-stage
- coingecko-scanner, stage-coingecko-scanner-bot
- crypto-recovery-ai-bot
- develop-pswmeta (все deployments)
- external-secrets, external-secrets-system
- gitlab
- istio мониторинг (grafana, kiali, prometheus)
- metallb controller
- stage-pswmeta (все deployments)

### ЭТАП 2: Удалён NotReady узел ✅
- canton-node-65-108-15-30 удалён из кластера

### ЭТАП 3: Очищены ресурсы ✅
- Challenges (удалены несколько раз, но появляются снова!)
- Orders, CertificateRequests
- Pending поды в maximus, kube-system и других namespaces

---

## ⚠️ ОСТАВШИЕСЯ ПРОБЛЕМЫ

### 1. CPU control-plane 99% (ГЛАВНАЯ ПРОБЛЕМА)
Несмотря на выполненные действия, CPU всё ещё 99%

**Возможные причины:**
- etcd переполнен events и объектами
- Оставшиеся deployments продолжают генерировать scheduler events
- k3s внутренние процессы перегружены

### 2. Traefik НЕ РАБОТАЕТ
```
kube-system   traefik   0/1   1   0   376d
```
**Влияние:** ВСЕ сайты недоступны (gyber.org, 1otc.cc, etc.)

### 3. Deployments с DESIRED > READY (генерируют нагрузку)
```
canton-otc       canton-otc                   1/2
default          auradomus-deployment         2/3
default          dsp-prod-deployment-primary  2/3
default          dsp-stage-deployment         1/2
default          multi-swarm-system-prod      2/3
supabase         oidc-provider                0/1
supabase         supabase-auth                0/1
supabase         supabase-rest                0/2
supabase-stage   supabase-auth                0/1
supabase-stage   supabase-kong                0/1
```

### 4. Challenges появляются снова
- Cert-manager остановлен, но challenges создаются
- Возможно есть webhook или controller который их создаёт

---

## 🎯 ЧТО НУЖНО СДЕЛАТЬ

### ПРИОРИТЕТ 1: Снизить CPU до < 50%

**Шаг 1: Уменьшить replicas для всех проблемных deployments**
```bash
# Все команды с --request-timeout=120s !

# Уменьшить до 1 реплики
kubectl scale deployment canton-otc -n canton-otc --replicas=1 --request-timeout=60s
kubectl scale deployment auradomus-deployment -n default --replicas=1 --request-timeout=60s
kubectl scale deployment dsp-prod-deployment-primary -n default --replicas=1 --request-timeout=60s
kubectl scale deployment dsp-stage-deployment -n default --replicas=1 --request-timeout=60s
kubectl scale deployment multi-swarm-system-prod -n default --replicas=1 --request-timeout=60s

# Полностью остановить supabase
kubectl scale deployment --all -n supabase --replicas=0 --request-timeout=60s
kubectl scale deployment --all -n supabase-stage --replicas=0 --request-timeout=60s
```

**Шаг 2: Очистить events (снизить нагрузку на etcd)**
```bash
# Удалить старые events
kubectl delete events -A --field-selector reason=FailedScheduling --request-timeout=120s
kubectl delete events -A --field-selector reason=FailedMount --request-timeout=120s
```

**Шаг 3: Если CPU не падает - перезапуск k3s**
```bash
# SSH на control-plane
ssh root@31.129.105.180

# Перезапустить k3s
systemctl restart k3s

# Проверить статус
systemctl status k3s
```

### ПРИОРИТЕТ 2: Восстановить Traefik

После того как CPU < 50%:
```bash
kubectl scale deployment traefik -n kube-system --replicas=1 --request-timeout=60s
kubectl wait --for=condition=available deployment/traefik -n kube-system --timeout=180s
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
```

### ПРИОРИТЕТ 3: Настроить cert-manager правильно

```bash
# Применить правильную конфигурацию
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
    "--v=2",
    "--cluster-resource-namespace=$(POD_NAMESPACE)",
    "--leader-election-namespace=kube-system",
    "--max-concurrent-challenges=5",
    "--acme-http01-solver-pod-grace-period=1m",
    "--enable-certificate-owner-ref=true"
  ]}
]' --request-timeout=60s

# Установить лимиты ресурсов
kubectl patch deployment cert-manager -n cert-manager --type json -p '[
  {"op": "add", "path": "/spec/template/spec/containers/0/resources", "value": {
    "limits": {"cpu": "500m", "memory": "512Mi"},
    "requests": {"cpu": "100m", "memory": "128Mi"}
  }}
]' --request-timeout=60s

# Запустить
kubectl scale deployment cert-manager -n cert-manager --replicas=1 --request-timeout=60s
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1 --request-timeout=60s
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1 --request-timeout=60s
```

### ПРИОРИТЕТ 4: Восстановить canton-otc

```bash
kubectl get pods -n canton-otc --request-timeout=60s
kubectl logs deployment/canton-otc -n canton-otc --tail=50 --request-timeout=60s
```

---

## ⚠️ КРИТИЧЕСКИ ВАЖНО

1. **ВСЕ команды kubectl с --request-timeout=60s минимум!**
   API server медленный - короткие таймауты приводят к ошибкам

2. **НЕ запускать `kubectl get pods -A` без таймаута!**
   Это перегрузит API server

3. **Восстанавливать сервисы ПО ОДНОМУ**
   После каждого - проверять CPU

4. **Паузы между командами обязательны**
   Минимум 3-5 секунд между операциями

---

## 🔧 ПОЛЕЗНЫЕ КОМАНДЫ

```bash
# Проверить CPU
kubectl top nodes --request-timeout=60s

# Проверить Pending поды
kubectl get pods -A --field-selector status.phase=Pending --request-timeout=120s | head -30

# Проверить challenges
kubectl get challenges -A --request-timeout=60s

# Удалить все challenges
kubectl delete challenges --all -A --request-timeout=120s

# Проверить deployments с проблемами
kubectl get deployments -A --request-timeout=120s | grep -v "1/1\|2/2\|3/3\|0/0"

# Проверить traefik
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik --request-timeout=60s

# Проверить сайты
curl -I -m 10 https://gyber.org
curl -I -m 10 https://1otc.cc
```

---

## 📋 ЧЕКЛИСТ ДЛЯ ЗАВЕРШЕНИЯ

- [ ] CPU tmedm < 50%
- [ ] Traefik 1/1 Running
- [ ] cert-manager работает с max-concurrent-challenges=5
- [ ] Challenges = 0 (при работающем cert-manager они должны обрабатываться)
- [ ] canton-otc работает (1/1)
- [ ] Сайты gyber.org, 1otc.cc доступны
- [ ] Pending подов < 5

---

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

- `EMERGENCY_CLUSTER_RECOVERY_FINAL.md` - детальный план восстановления
- `CLUSTER_RECOVERY_STATUS_REPORT.md` - текущий отчёт о статусе
- `CERT_MANAGER_ROOT_CAUSE_ANALYSIS.md` - анализ проблемы cert-manager
- `scripts/complete-cluster-recovery.sh` - скрипт восстановления (требует доработки)

---

## 🚨 ЭКСТРЕННЫЙ ОТКАТ

Если ситуация ухудшилась:
```bash
# Остановить всё что запустили
kubectl scale deployment traefik -n kube-system --replicas=0 --request-timeout=60s
kubectl scale deployment cert-manager -n cert-manager --replicas=0 --request-timeout=60s
kubectl scale deployment --all -n canton-otc --replicas=0 --request-timeout=60s

# Подождать 5 минут
sleep 300

# Проверить CPU
kubectl top nodes --request-timeout=60s
```

---

**Версия:** 1.0  
**Дата:** 18 января 2026  
**Автор:** AI DevOps Analysis

---

# ЗАДАЧА ДЛЯ НОВОГО ЧАТА

Продолжи восстановление кластера K3s. Главные задачи:

1. **Снизить CPU control-plane (tmedm) с 99% до < 50%**
2. **Запустить Traefik** для восстановления доступа к сайтам
3. **Настроить cert-manager** с ограничением max-concurrent-challenges=5
4. **Восстановить canton-otc** и проверить его работоспособность
5. **Проверить доступность сайтов** gyber.org, 1otc.cc

Используй команды из этого промпта. ВСЕ команды с --request-timeout=60s минимум!
