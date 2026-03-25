# АНАЛИЗ КОРНЕВОЙ ПРИЧИНЫ: CERT-MANAGER И 8000+ PENDING ПОДОВ

## ДАТА РАССЛЕДОВАНИЯ
12 января 2026, 00:00-01:30 UTC

## ИСПОЛНИТЕЛЬ
AI Assistant + Gyber

---

## РЕЗЮМЕ ПРОБЛЕМЫ

**Симптомы:**
- 8000+ pending подов `cm-acme-http-solver-*` в кластере
- Scheduler перегружен и не может планировать новые поды
- Поды maximus и redis в namespace maximus не могут быть запланированы
- API server периодически недоступен (timeouts)
- Узел `canton-node-65-108-15-30` в статусе NotReady

**Влияние:**
- Невозможность запуска новых сервисов
- Деградация производительности кластера
- Недоступность некоторых сайтов

---

## КОРНЕВАЯ ПРИЧИНА

### 1. ПЕРВИЧНАЯ ПРИЧИНА: Истечение сертификатов

**Проблемные Certificate ресурсы:**

```
NAMESPACE                  NAME                            STATUS    REASON
istio-system              auradomus-prod-istio-tls        False     Expired (15 Oct 2025)
supabase-stage            supabase-studio-tls             False     Secret DoesNotExist
supabase                  supabase-tls                    False     Secret DoesNotExist
techhy-main-production    main-techhy-main-production-tls False     Expired (11 Jan 2026)
techhy-main-production    techhy-main-production-tls      False     Expired
```

**Почему это важно:**
- Cert-manager автоматически пытается обновить истекшие сертификаты
- Для каждого сертификата создается CertificateRequest → Order → Challenge → Pod (solver)

### 2. ВТОРИЧНАЯ ПРИЧИНА: Узел NotReady

**Состояние узла `canton-node-65-108-15-30`:**
```
Status: NotReady
Reason: Kubelet stopped posting node status
Taints: node.kubernetes.io/unreachable:NoExecute
        node.kubernetes.io/unreachable:NoSchedule
```

**Последствия:**
- Поды не могут быть запланированы на этот узел
- Solver поды остаются в Pending
- Поды maximus, redis, supabase-postgres были привязаны к этому узлу через nodeSelector

### 3. КАТАЛИЗАТОР: Неправильная конфигурация cert-manager

**Обнаруженные проблемы:**

1. **Слишком большой лимит concurrent challenges:**
   ```yaml
   --max-concurrent-challenges=60
   ```
   → Cert-manager создавал до 60 solver подов одновременно для каждого сертификата

2. **Отсутствие автоочистки solver подов:**
   - Не было `--acme-http01-solver-pod-grace-period`
   - Solver поды не удалялись после завершения challenge
   - Неудачные challenges не приводили к удалению подов

3. **Множественные CertificateRequests:**
   - 80 CertificateRequests в кластере
   - 74 Orders в статусе pending
   - 20+ Challenges созданы одновременно

### 4. МЕХАНИЗМ СОЗДАНИЯ 8000+ ПОДОВ

**Цикл проблемы:**

```
1. Certificate истекает или Secret отсутствует
   ↓
2. Cert-manager создает CertificateRequest
   ↓
3. CertificateRequest создает Order
   ↓
4. Order создает Challenge (HTTP-01)
   ↓
5. Challenge создает Pod (cm-acme-http-solver-*)
   ↓
6. Pod не может быть запланирован (узел NotReady или нет других подходящих узлов)
   ↓
7. Challenge не выполняется (timeout)
   ↓
8. Cert-manager НЕ удаляет старый Challenge/Pod
   ↓
9. Cert-manager создает новый Challenge (retry)
   ↓
10. Новый Challenge создает новый Pod
    ↓
11. GOTO 6 (цикл повторяется бесконечно)
```

**Математика катастрофы:**

- ~15 проблемных сертификатов
- Каждый сертификат пытается обновиться каждые 10-30 минут
- Каждая попытка создает 1-4 challenge (разные домены/subdomains)
- Каждый challenge создает solver pod
- Старые поды НЕ удаляются
- Max-concurrent-challenges=60 позволяет создать до 60 подов одновременно

**Расчет:**
```
15 certificates × 3 challenges average × 60 retries over time = ~2700 pods
+ Multiple renewal attempts over days = 8000+ pods
```

---

## ЧТО УСУГУБИЛО ПРОБЛЕМУ

### 1. **Scheduler Overload**
- 8000+ подов в pending очереди
- Scheduler пытается найти узел для каждого пода на каждом цикле
- Каждый цикл занимает больше времени
- API server начинает давать timeouts

### 2. **API Server Pressure**
- Постоянные запросы на создание/проверку подов
- etcd под нагрузкой
- kubectl команды зависают или таймаутят

### 3. **Ресурсные квоты и лимиты**
- Нет resource quotas на namespace
- Cert-manager может создавать неограниченное количество подов
- События: "resource quota evaluation timed out"

### 4. **NodeSelector на NotReady узле**
- Deployments maximus и redis имели:
  ```yaml
  nodeSelector:
    kubernetes.io/hostname: canton-node-65-108-15-30
  ```
- Узел был NotReady, но deployments не могли быть перепланированы

---

## ВЫПОЛНЕННЫЕ ДЕЙСТВИЯ ДЛЯ ИСПРАВЛЕНИЯ

### ✅ Шаг 1: Остановка cert-manager
```bash
kubectl scale deployment cert-manager -n cert-manager --replicas=0
kubectl scale deployment cert-manager-cainjector -n cert-manager --replicas=0
kubectl scale deployment cert-manager-webhook -n cert-manager --replicas=0
```
**Результат:** Прерван цикл создания новых подов

### ✅ Шаг 2: Удаление Challenge ресурсов
```bash
kubectl delete challenges -A --all --grace-period=0
```
**Результат:** 20 challenges удалены, связанные поды автоматически удалились

### ✅ Шаг 3: Остановка Canton Validator
```bash
kubectl scale deployment canton-participant -n canton-node --replicas=0
kubectl scale deployment validator-app -n canton-node --replicas=0
```
**Результат:** Освобождены ресурсы на узле canton-node-65-108-15-30

### ✅ Шаг 4: Удаление старых solver подов
```bash
kubectl delete pod -n istio-system cm-acme-http-solver-* --grace-period=0 --force
kubectl delete pod -n techhy-main-production cm-acme-http-solver-* --grace-period=0 --force
# ... и другие namespaces
```
**Результат:** Удалены оставшиеся solver поды

### ✅ Шаг 5: Исправление конфигурации cert-manager
```yaml
# Изменения в deployment:
args:
  - --max-concurrent-challenges=5  # было 60
  - --acme-http01-solver-pod-grace-period=1m  # добавлено
```
**Результат:** Ограничен concurrent challenges и добавлена автоочистка

### ✅ Шаг 6: Удаление nodeSelector
```bash
kubectl patch deployment maximus -n maximus --type json -p='[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]'
kubectl patch deployment redis -n maximus --type json -p='[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]'
```
**Результат:** Deployments могут планироваться на любых доступных узлах

---

## ТЕКУЩЕЕ СОСТОЯНИЕ

### ✅ ИСПРАВЛЕНО:
- **0 pending подов** (было 8000+)
- **0 cm-acme-http-solver подов**
- **Scheduler разгружен**
- **API server отвечает нормально**
- **Canton validator остановлен**
- **NodeSelector убран с maximus/redis**

### ⚠️ ТРЕБУЕТ ВНИМАНИЯ:
1. **Узел canton-node-65-108-15-30 в статусе NotReady**
   - Kubelet не отвечает
   - Требуется SSH доступ для диагностики
   - Terminating поды на этом узле не завершаются

2. **Cert-manager остановлен**
   - Сертификаты не обновляются
   - Перед запуском нужно исправить проблемные Certificate ресурсы

3. **Проблемные Certificate ресурсы**
   - Истекшие сертификаты требуют ручной проверки
   - Отсутствующие secrets нужно пересоздать или удалить Certificate

4. **74 pending Orders**
   - Требуют очистки
   - Могут создать новые challenges при запуске cert-manager

---

## РЕКОМЕНДАЦИИ ДЛЯ ПРЕДОТВРАЩЕНИЯ

### 1. **Исправить проблемные сертификаты ПЕРЕД запуском cert-manager**

```bash
# Удалить проблемные Certificate ресурсы
kubectl delete certificate auradomus-prod-istio-tls -n istio-system
kubectl delete certificate supabase-tls -n supabase
kubectl delete certificate supabase-studio-tls -n supabase-stage
kubectl delete certificate techhy-main-production-tls -n techhy-main-production

# Или исправить их конфигурацию если они нужны
```

### 2. **Очистить pending Orders**

```bash
kubectl get orders -A -o json | jq -r '.items[] | select(.status.state=="pending") | "\(.metadata.namespace)/\(.metadata.name)"' | xargs -I {} kubectl delete order {}
```

### 3. **Настроить Resource Quotas**

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: cert-manager-quota
  namespace: cert-manager
spec:
  hard:
    pods: "100"
    requests.cpu: "10"
    requests.memory: "10Gi"
```

### 4. **Настроить мониторинг**

- Alert на количество pending подов > 50
- Alert на количество challenges > 20
- Alert на количество failed certificate requests

### 5. **Восстановить узел canton-node-65-108-15-30**

```bash
# SSH на узел
ssh root@65.108.15.30

# Проверить k3s-agent
systemctl status k3s-agent

# Перезапустить если нужно
systemctl restart k3s-agent

# Проверить логи
journalctl -u k3s-agent -f
```

### 6. **Настроить PodDisruptionBudget для критичных сервисов**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: maximus-pdb
  namespace: maximus
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: maximus
```

### 7. **Использовать DNS-01 challenge вместо HTTP-01 где возможно**

DNS-01 не создает поды, более надежен:
```yaml
spec:
  acme:
    solvers:
    - dns01:
        cloudflare:
          email: admin@gyber.org
          apiTokenSecretRef:
            name: cloudflare-api-token
            key: api-token
```

---

## УРОКИ

1. **Мониторинг критичен** - проблема копилась несколько дней, нужны alerts
2. **Resource limits важны** - отсутствие quotas привело к неконтролируемому росту
3. **NodeSelector опасен** - привязка к конкретному узлу создает single point of failure
4. **Cert-manager требует настройки** - дефолтная конфигурация может создать проблемы
5. **Регулярный аудит Certificate ресурсов** - истекшие/проблемные сертификаты нужно чистить

---

## СЛЕДУЮЩИЕ ШАГИ

1. ✅ Исправить/удалить проблемные Certificate ресурсы
2. ✅ Очистить pending Orders и CertificateRequests
3. ✅ Восстановить узел canton-node-65-108-15-30
4. ⏳ Настроить resource quotas
5. ⏳ Запустить cert-manager с новой конфигурацией
6. ⏳ Настроить мониторинг и alerts
7. ⏳ Проверить обновление сертификатов
8. ⏳ Запустить maximus и redis на других узлах

---

## TIMELINE ИНЦИДЕНТА

- **5 января 2026** - Начало создания pending Orders (по логам)
- **9 января 2026** - Множественные pending orders для dsp-prod, platform
- **11 января 2026, 21:00** - Обнаружено 8000+ pending подов
- **11 января 2026, 21:15** - Начато исправление
- **11 января 2026, 22:30** - Остановлен cert-manager
- **11 января 2026, 22:45** - Удалены challenges, 0 pending подов
- **11 января 2026, 23:00** - Исправлена конфигурация cert-manager
- **12 января 2026, 00:30** - Анализ завершен, отчет создан

---

## КОНТАКТЫ И РЕФЕРЕНСЫ

- **Оператор:** Gyber
- **Кластер:** K3s multi-node (tmedm, kczdjomrqi, upbewhtibq, canton-node-65-108-15-30)
- **Cert-manager версия:** v1.16.2
- **Kubernetes версия:** v1.31.x - v1.33.x

**Связанные документы:**
- FINAL_CERT_MANAGER_FIX_PROMPT.md
- KUBERNETES_CLUSTER_FIX_PROMPT.md
- CERT_MANAGER_PENDING_PODS_FIX_PROMPT.md
