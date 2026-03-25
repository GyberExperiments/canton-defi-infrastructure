# ПРОМПТ ДЛЯ ИСПРАВЛЕНИЯ ПРОБЛЕМ С КУБЕРНЕТЕС КЛАСТЕРОМ

## КОНТЕКСТ ПРОБЛЕМЫ

В Kubernetes кластере (K3s) не работают 3 сайта:
1. **gyber.org** - ИСПРАВЛЕНО (но нужно проверить доступность)
2. **1otc.cc** - ИСПРАВЛЕНО (но нужно проверить доступность)
3. **maximus-marketing-swarm.gyber.org** - ЧАСТИЧНО ИСПРАВЛЕНО (критическая проблема с планированием подов)

## ИНФОРМАЦИЯ О КЛАСТЕРЕ

### Узлы кластера:
```
NAME                       STATUS   ROLES                  AGE    VERSION        INTERNAL-IP      EXTERNAL-IP
canton-node-65-108-15-30   Ready    <none>                 60d    v1.33.6+k3s1   65.108.15.30     <none>
kczdjomrqi                 Ready    worker                 194d   v1.31.5+k3s1   45.9.41.209      <none>
tmedm                      Ready    control-plane,master   142d   v1.31.4+k3s1   31.129.105.180   <none>
upbewhtibq                 Ready    <none>                 192d   v1.32.5+k3s1   46.173.18.60     <none>
```

### Использование ресурсов узлов:
```
NAME                       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
canton-node-65-108-15-30   321m         2%       21599Mi         33%
kczdjomrqi                 130m         6%       1750Mi          44%
tmedm                      3989m        99%      4609Mi          58%  ⚠️ ПЕРЕГРУЖЕН
upbewhtibq                 119m         3%       2102Mi          42%
```

### Ingress Controller:
- **Traefik** работает на LoadBalancer IP: **65.108.15.30**
- Порты: 80, 443

## ДЕТАЛЬНОЕ ОПИСАНИЕ ПРОБЛЕМ

### 1. gyber.org - ИСПРАВЛЕНО, НО ТРЕБУЕТ ПРОВЕРКИ

**Что было исправлено:**
- Удален конфликт ingress класса (был `ingressClassName: traefik` + аннотация `kubernetes.io/ingress.class: istio`)
- Удалены проблемные challenge для сертификата (пытались использовать Gateway API)
- Сертификат в статусе Ready

**Текущее состояние:**
- Namespace: `default`
- Ingress: `dsp-prod-ingress` (traefik, IP: 65.108.15.30, порты: 80, 443)
- Сертификат: `dsp-prod-tls` (Ready, действителен до 2026-02-08)
- Поды: `dsp-prod-deployment-primary` (3 реплики, все Running)
- Endpoints: `10.42.0.110:3000, 10.42.1.38:3000`

**Проверить:**
- Доступность сайта через HTTPS
- Работает ли редирект с HTTP на HTTPS

### 2. 1otc.cc - ИСПРАВЛЕНО, НО ТРЕБУЕТ ПРОВЕРКИ

**Что было исправлено:**
- Создан HTTPS ingress `canton-otc-ingress-https` из конфигурации
- Обновлен сертификат: добавлены домены `1otc.cc`, `cantonotc.com`, `canton-otc.com`
- Сертификат в статусе Ready

**Текущее состояние:**
- Namespace: `canton-otc`
- Ingress:
  - `canton-otc-ingress-https` (traefik, IP: 65.108.15.30, порты: 80, 443) - HTTPS
  - `canton-otc-ingress-redirect` (traefik, IP: 65.108.15.30, порт: 80) - HTTP редирект
- Сертификат: `canton-otc-tls` (Ready, действителен до 2026-04-11)
- Поды: `canton-otc-c85b7ff68-*` (2 реплики, все Running)
- Endpoints: `10.42.1.99:3000`

**Проверить:**
- Доступность сайта через HTTPS
- Работает ли редирект с HTTP на HTTPS

### 3. maximus-marketing-swarm.gyber.org - КРИТИЧЕСКАЯ ПРОБЛЕМА

**Что было исправлено:**
- Ingress настроен (traefik, IP: 65.108.15.30, порты: 80, 443)
- Сертификат в статусе Ready
- Redis переведен с StatefulSet на Deployment (без PVC, использует emptyDir)
- Назначен nodeSelector на узел `canton-node-65-108-15-30`

**КРИТИЧЕСКАЯ ПРОБЛЕМА:**
Поды `maximus` и `redis` **НЕ МОГУТ БЫТЬ ЗАПЛАНИРОВАНЫ** на узел, несмотря на:
- Достаточные ресурсы узла (CPU 70%, Memory 31%)
- Правильный nodeSelector
- Отсутствие taints на узле
- Узел в статусе Ready

**Текущее состояние:**
- Namespace: `maximus`
- Ingress: `maximus-ingress` (traefik, IP: 65.108.15.30, порты: 80, 443)
- Сертификат: `maximus-tls` (Ready, действителен до 2026-04-11)
- Deployment `maximus`: 1 реплика, но под в статусе **Pending** (18+ минут)
- Deployment `redis`: 1 реплика, но под в статусе **Pending** (18+ минут)
- Старый под `maximus-7c878f8d78-7p2gv` (IP: 10.42.1.81:3000) все еще работает и в endpoint
- Endpoints: `maximus` → `10.42.1.81:3000` (старый под), `redis` → нет endpoints

**Детали Pending подов:**

**maximus-55d4485875-g857d:**
- Статус: Pending (18+ минут)
- NodeSelector: `kubernetes.io/hostname: canton-node-65-108-15-30`
- Ресурсы: CPU 250m, Memory 512Mi
- События: **НЕТ СОБЫТИЙ** (это странно - scheduler должен был попытаться запланировать)

**redis-5dbcc584fb-zvfkj:**
- Статус: Pending (18+ минут)
- NodeSelector: `kubernetes.io/hostname: canton-node-65-108-15-30`
- Ресурсы: CPU 100m, Memory 256Mi
- События: **НЕТ СОБЫТИЙ**

**Проблема с приложением:**
- Старый под `maximus-5556b596b9-tkwwj` в CrashLoopBackOff
- Логи показывают: `Redis connection error: connect ETIMEDOUT` и `Reached the max retries per request limit`
- Приложение падает из-за отсутствия подключения к Redis

**Узел canton-node-65-108-15-30:**
- Статус: Ready
- Taints: нет
- Unschedulable: false
- Ресурсы:
  - CPU: 8400m запрошено (70%), доступно 12 CPU
  - Memory: 20260Mi запрошено (31%), доступно 65743116Ki
  - Pods: 56 подов запущено, лимит 110
- Последний перезапуск kubelet: 2m59s назад (предупреждение: `InvalidDiskCapacity`)

## КОНФИГУРАЦИИ

### Deployment maximus:
```yaml
replicas: 1
nodeSelector:
  kubernetes.io/hostname: canton-node-65-108-15-30
resources:
  requests:
    cpu: 250m
    memory: 512Mi
```

### Deployment redis:
```yaml
replicas: 1
nodeSelector:
  kubernetes.io/hostname: canton-node-65-108-15-30
resources:
  requests:
    cpu: 100m
    memory: 256Mi
volumes:
  - name: redis-data
    emptyDir: {}
```

## СОБЫТИЯ И ЛОГИ

### Ключевые события:
- Узел перезапускался несколько раз (последний раз 2m59s назад)
- Предупреждение: `InvalidDiskCapacity: invalid capacity 0 on image filesystem`
- Старый под maximus падает из-за отсутствия Redis
- Новые поды создаются, но не планируются (нет событий от scheduler)

### Логи Traefik:
- Ошибки с некоторыми сервисами (нет endpoints)
- Но для maximus, gyber.org, 1otc.cc ошибок нет

## ЗАДАЧИ ДЛЯ РЕШЕНИЯ

### Приоритет 1: КРИТИЧНО
1. **Исправить планирование подов maximus и redis**
   - Поды в Pending 18+ минут без событий от scheduler
   - Проверить логи scheduler
   - Проверить, почему scheduler не может запланировать поды на узел
   - Возможно проблема с предупреждением `InvalidDiskCapacity`

2. **Обеспечить работу Redis для maximus**
   - Без Redis приложение падает
   - Нужно либо запустить Redis, либо настроить приложение на работу без Redis (если возможно)

### Приоритет 2: ВАЖНО
3. **Проверить доступность всех трех сайтов**
   - Проверить через curl/браузер
   - Проверить HTTPS сертификаты
   - Проверить редиректы HTTP → HTTPS

4. **Исправить предупреждение на узле**
   - `InvalidDiskCapacity: invalid capacity 0 on image filesystem`
   - Это может влиять на планирование подов

### Приоритет 3: ОПТИМИЗАЦИЯ
5. **Очистить старые Pending поды**
   - 7087 Pending подов в namespace `platform-gyber-org` (в основном cert-manager)
   - Это может влиять на производительность scheduler

6. **Мониторинг узла tmedm**
   - Узел загружен на 99% CPU
   - Возможно требуется масштабирование или оптимизация

## КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

```bash
# Проверить состояние подов
kubectl get pods -n maximus -o wide
kubectl describe pod maximus-55d4485875-g857d -n maximus
kubectl describe pod redis-5dbcc584fb-zvfkj -n maximus

# Проверить scheduler
kubectl get pods -n kube-system | grep scheduler
kubectl logs -n kube-system -l component=kube-scheduler --tail=100

# Проверить узел
kubectl describe node canton-node-65-108-15-30
kubectl get events --field-selector involvedObject.name=canton-node-65-108-15-30

# Проверить доступность сайтов
curl -I https://gyber.org
curl -I https://1otc.cc
curl -I https://maximus-marketing-swarm.gyber.org

# Проверить endpoints
kubectl get endpoints -n maximus
kubectl get endpoints -n default dsp-prod-deployment-primary
kubectl get endpoints -n canton-otc canton-otc-service
```

## ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Узел недавно перезапускался** - возможно scheduler еще не стабилизировался
2. **Предупреждение InvalidDiskCapacity** - может влиять на планирование
3. **Старый под maximus работает** - сайт может быть доступен через него, но это временное решение
4. **Нет событий от scheduler** - это очень странно, обычно scheduler должен пытаться запланировать поды

## ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
- Все три сайта должны быть доступны через HTTPS
- Поды maximus и redis должны быть запущены и работать
- Endpoints должны указывать на работающие поды
- Не должно быть Pending подов (кроме временных cert-manager)

## ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

Все конфигурации сохранены в:
- `/tmp/maximus-pods.yaml`
- `/tmp/maximus-deployment.yaml`
- `/tmp/redis-deployment.yaml`
- `/tmp/ingress-configs.yaml`
- `/tmp/certificates.yaml`
- `/tmp/pending-pods-details.json`
- `/tmp/node-description.txt`
- `/tmp/relevant-events.txt`

Используй эти файлы для детального анализа, если потребуется.
