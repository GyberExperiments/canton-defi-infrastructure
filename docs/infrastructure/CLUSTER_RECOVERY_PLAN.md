# ПЛАН ВОССТАНОВЛЕНИЯ КЛАСТЕРА ПОСЛЕ CERT-MANAGER ИНЦИДЕНТА

**Дата создания:** 12 января 2026  
**Статус:** В процессе  
**Ответственный:** Gyber

---

## ТЕКУЩЕЕ СОСТОЯНИЕ

### ✅ ВЫПОЛНЕНО:
- [x] Остановлен cert-manager (replicas=0)
- [x] Удалены все Challenge ресурсы (20 шт)
- [x] Удалены все cm-acme-http-solver поды (8000+ шт)
- [x] Количество pending подов: **0**
- [x] Остановлен Canton Validator
- [x] Убран nodeSelector с maximus/redis deployments
- [x] Исправлена конфигурация cert-manager (max-concurrent-challenges=5)
- [x] Удалены проблемные Orders (9 из 16)
- [x] Удалены проблемные CertificateRequests (10 шт)

### ⚠️ ТРЕБУЕТ ДЕЙСТВИЙ:
- [ ] Восстановить узел canton-node-65-108-15-30 (NotReady)
- [ ] Исправить проблемные Certificate ресурсы
- [ ] Запустить maximus и redis
- [ ] Настроить resource quotas
- [ ] Запустить cert-manager обратно
- [ ] Настроить мониторинг

---

## ПРИОРИТЕТ 1: ВОССТАНОВЛЕНИЕ КРИТИЧНЫХ СЕРВИСОВ

### 1.1 Проверка состояния maximus и redis

```bash
# Проверить текущие поды
kubectl get pods -n maximus -o wide

# Проверить deployments
kubectl get deployments -n maximus

# Если не запущены - перезапустить
kubectl rollout restart deployment maximus -n maximus
kubectl rollout restart deployment redis -n maximus

# Проверить логи если есть проблемы
kubectl logs -n maximus -l app=maximus --tail=50
kubectl logs -n maximus -l app=redis --tail=50
```

**Ожидаемый результат:** Поды maximus и redis запущены на доступных узлах (tmedm, kczdjomrqi, upbewhtibq)

### 1.2 Проверка endpoints и доступности

```bash
# Проверить endpoints
kubectl get endpoints -n maximus

# Проверить services
kubectl get services -n maximus

# Проверить ingress если есть
kubectl get ingress -n maximus
```

---

## ПРИОРИТЕТ 2: ВОССТАНОВЛЕНИЕ УЗЛА canton-node-65-108-15-30

### 2.1 Диагностика узла

**ТРЕБУЕТСЯ SSH ДОСТУП к 65.108.15.30**

```bash
# Подключиться к узлу
ssh root@65.108.15.30

# Проверить статус k3s-agent
systemctl status k3s-agent

# Проверить логи
journalctl -u k3s-agent -n 100 --no-pager

# Проверить ресурсы
df -h
free -h
top
```

### 2.2 Возможные действия (в зависимости от диагностики)

**Вариант A: Перезапуск k3s-agent**
```bash
systemctl restart k3s-agent
systemctl status k3s-agent

# Подождать 2-3 минуты
sleep 180

# Проверить из мастера
kubectl get nodes
```

**Вариант B: Полная переустановка k3s-agent**
```bash
# Остановить k3s-agent
systemctl stop k3s-agent

# Удалить старые данные
rm -rf /var/lib/rancher/k3s/agent

# Переустановить (нужен токен от мастера)
curl -sfL https://get.k3s.io | K3S_URL=https://master-ip:6443 K3S_TOKEN=xxx sh -

# Проверить
systemctl status k3s-agent
```

**Вариант C: Временно отключить узел**
```bash
# Если узел не нужен срочно - отключить из кластера
kubectl drain canton-node-65-108-15-30 --ignore-daemonsets --delete-emptydir-data --force
kubectl delete node canton-node-65-108-15-30
```

### 2.3 Очистка terminating подов

```bash
# После восстановления узла или его удаления
kubectl get pods -A --field-selector status.phase=Terminating -o json | \
  jq -r '.items[] | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete pod "$name" -n "$ns" --grace-period=0 --force
  done
```

---

## ПРИОРИТЕТ 3: ОЧИСТКА CERT-MANAGER РЕСУРСОВ

### 3.1 Удаление проблемных Certificate ресурсов

```bash
# Список проблемных сертификатов:
# 1. auradomus-prod-istio-tls (expired, не используется?)
# 2. supabase-tls (secret missing)
# 3. supabase-studio-tls (secret missing)
# 4. main-techhy-main-production-tls (expired)
# 5. techhy-main-production-tls (expired)

# Проверить используются ли они
kubectl get ingress -A -o yaml | grep -A 5 "secretName: auradomus-prod-istio-tls"

# Если НЕ используются - удалить
kubectl delete certificate auradomus-prod-istio-tls -n istio-system

# Для supabase сертификатов - проверить нужны ли они
kubectl get ingress -n supabase -o yaml
kubectl get ingress -n supabase-stage -o yaml

# Если используются но secret отсутствует - пересоздать Certificate
kubectl delete certificate supabase-tls -n supabase
kubectl delete certificate supabase-studio-tls -n supabase-stage
# Потом создать заново с правильной конфигурацией

# Для techhy - проверить текущее использование
kubectl describe certificate main-techhy-main-production-tls -n techhy-main-production
kubectl describe certificate techhy-main-production-tls -n techhy-main-production

# Если дублируются - оставить один, удалить другой
```

### 3.2 Очистка оставшихся Orders

```bash
# Удалить все pending orders
kubectl get orders -A -o json | \
  jq -r '.items[] | select(.status.state=="pending") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete order "$name" -n "$ns" --grace-period=0 --timeout=10s || true
  done

# Проверить результат
kubectl get orders -A | grep pending
```

### 3.3 Очистка оставшихся CertificateRequests

```bash
# Удалить проблемные CertificateRequests
kubectl get certificaterequests -A -o json | \
  jq -r '.items[] | select(.status.conditions[]?.status=="False") | "\(.metadata.namespace) \(.metadata.name)"' | \
  while read ns name; do
    kubectl delete certificaterequest "$name" -n "$ns" --grace-period=0 || true
  done

# Проверить результат
kubectl get certificaterequests -A | grep -v True
```

---

## ПРИОРИТЕТ 4: НАСТРОЙКА RESOURCE QUOTAS

### 4.1 Создание ResourceQuota для cert-manager

```yaml
# Файл: config/kubernetes/cert-manager-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: cert-manager-quota
  namespace: cert-manager
spec:
  hard:
    pods: "50"
    requests.cpu: "5"
    requests.memory: "5Gi"
    limits.cpu: "10"
    limits.memory: "10Gi"
```

```bash
# Применить
kubectl apply -f config/kubernetes/cert-manager-quota.yaml
```

### 4.2 Создание ResourceQuota для default namespace

```yaml
# Файл: config/kubernetes/default-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: default-quota
  namespace: default
spec:
  hard:
    pods: "200"
    requests.cpu: "20"
    requests.memory: "40Gi"
```

```bash
# Применить
kubectl apply -f config/kubernetes/default-quota.yaml
```

---

## ПРИОРИТЕТ 5: ЗАПУСК CERT-MANAGER

### 5.1 Проверка конфигурации

```bash
# Проверить deployment
kubectl get deployment cert-manager -n cert-manager -o yaml | grep -A 10 "args:"

# Должно быть:
# - --max-concurrent-challenges=5
# - --acme-http01-solver-pod-grace-period=1m
```

### 5.2 Запуск cert-manager

```bash
# Запустить controller
kubectl scale deployment cert-manager -n cert-manager --replicas=1

# Подождать пока запустится
kubectl wait --for=condition=available --timeout=120s deployment/cert-manager -n cert-manager

# Запустить cainjector
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=1

# Запустить webhook
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=1

# Проверить статус
kubectl get pods -n cert-manager
```

### 5.3 Мониторинг после запуска

```bash
# Проверять каждые 5 минут в течение 30 минут:

# 1. Количество подов
watch -n 60 'kubectl get pods -A | grep -c "cm-acme-http-solver"'

# 2. Количество pending подов
watch -n 60 'kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l'

# 3. Количество challenges
watch -n 60 'kubectl get challenges -A --no-headers | wc -l'

# 4. Логи cert-manager
kubectl logs -f -n cert-manager -l app=cert-manager
```

### 5.4 Критерии успеха

- ✅ Cert-manager под запущен и Ready
- ✅ Количество solver подов < 20
- ✅ Количество challenges < 10
- ✅ Новые сертификаты получаются успешно
- ✅ Нет ошибок в логах

### 5.5 Откат если проблемы повторяются

```bash
# Если solver поды начинают множиться снова:
kubectl scale deployment cert-manager -n cert-manager --replicas=0

# Проверить что пошло не так:
kubectl get certificates -A | grep False
kubectl get orders -A | grep pending
kubectl describe certificate <проблемный> -n <namespace>
```

---

## ПРИОРИТЕТ 6: НАСТРОЙКА МОНИТОРИНГА

### 6.1 Prometheus Rules (если используется)

```yaml
# Файл: config/kubernetes/cert-manager-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cert-manager-alerts
  namespace: cert-manager
spec:
  groups:
  - name: cert-manager
    interval: 60s
    rules:
    - alert: TooManyPendingPods
      expr: count(kube_pod_status_phase{phase="Pending"}) > 50
      for: 5m
      annotations:
        summary: "Too many pending pods in cluster"
    
    - alert: TooManyChallenges
      expr: count(certmanager_certificate_ready_status{condition="False"}) > 20
      for: 10m
      annotations:
        summary: "Too many cert-manager challenges"
    
    - alert: CertificateExpiringSoon
      expr: certmanager_certificate_expiration_timestamp_seconds - time() < 604800
      for: 1h
      annotations:
        summary: "Certificate expiring in less than 7 days"
```

### 6.2 Простой скрипт мониторинга (без Prometheus)

```bash
# Файл: scripts/monitor-cert-manager.sh
#!/bin/bash

while true; do
  PENDING_PODS=$(kubectl get pods -A --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l)
  SOLVER_PODS=$(kubectl get pods -A 2>/dev/null | grep -c "cm-acme-http-solver" || echo 0)
  CHALLENGES=$(kubectl get challenges -A --no-headers 2>/dev/null | wc -l)
  
  echo "[$(date)] Pending: $PENDING_PODS | Solvers: $SOLVER_PODS | Challenges: $CHALLENGES"
  
  if [ "$PENDING_PODS" -gt 100 ]; then
    echo "WARNING: Too many pending pods!"
  fi
  
  if [ "$SOLVER_PODS" -gt 50 ]; then
    echo "CRITICAL: Too many solver pods!"
  fi
  
  sleep 300  # Каждые 5 минут
done
```

```bash
# Запустить в screen/tmux
chmod +x scripts/monitor-cert-manager.sh
screen -dmS cert-monitor ./scripts/monitor-cert-manager.sh
```

---

## ПРИОРИТЕТ 7: ПРОВЕРКА СЕРВИСОВ

### 7.1 Проверка доступности сайтов

```bash
# Проверить основные сайты
curl -I https://platform.gyber.org
curl -I https://gyber.org
curl -I https://www.gyber.org
curl -I https://maximus.yourdomain.com  # если есть
```

### 7.2 Проверка ingress и сертификатов

```bash
# Проверить ingress ресурсы
kubectl get ingress -A

# Проверить используемые secrets
kubectl get ingress -A -o json | jq -r '.items[] | .spec.tls[]?.secretName' | sort -u | while read secret; do
  kubectl get secret "$secret" -o jsonpath='{.metadata.namespace} {.metadata.name} {.data.tls\.crt}' 2>/dev/null | \
    awk '{print $1, $2, (length($3) > 0 ? "EXISTS" : "MISSING")}'
done
```

---

## ЧЕКЛИСТ ФИНАЛЬНОЙ ПРОВЕРКИ

### Перед завершением восстановления проверить:

- [ ] Узел canton-node-65-108-15-30: Ready или удален из кластера
- [ ] Все критичные сервисы запущены (maximus, redis, supabase, etc)
- [ ] 0 terminating подов в кластере
- [ ] < 50 pending подов в кластере
- [ ] < 10 cm-acme-http-solver подов
- [ ] Cert-manager запущен и работает
- [ ] Новые сертификаты получаются успешно
- [ ] Resource quotas настроены
- [ ] Мониторинг работает
- [ ] Все сайты доступны
- [ ] Нет ошибок в логах cert-manager
- [ ] Документация обновлена

---

## КОНТАКТЫ ДЛЯ ЭСКАЛАЦИИ

**При проблемах:**
1. Остановить cert-manager: `kubectl scale deployment cert-manager -n cert-manager --replicas=0`
2. Создать issue с логами и описанием
3. Обратиться к документации: CERT_MANAGER_ROOT_CAUSE_ANALYSIS.md

**Полезные команды:**
```bash
# Быстрая диагностика
kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l
kubectl get challenges -A --no-headers | wc -l
kubectl get certificates -A | grep False
kubectl top nodes

# Логи
kubectl logs -n cert-manager -l app=cert-manager --tail=100
kubectl get events -A --sort-by='.lastTimestamp' | tail -20
```
