# Скрипты для исправления проблем с Kubernetes кластером

## Описание

Набор скриптов для диагностики и исправления проблем с Kubernetes кластером, описанных в `docs/infrastructure/KUBERNETES_CLUSTER_FIX_PROMPT.md`.

## Скрипты

### 1. `fix-kubernetes-cluster-complete.sh` - Главный скрипт

Комплексный скрипт, который запускает все проверки и исправления последовательно.

**Использование:**
```bash
./scripts/fix-kubernetes-cluster-complete.sh
```

**Что делает:**
- Исправляет проблемы с планированием подов
- Обрабатывает проблему InvalidDiskCapacity
- Проверяет доступность всех сайтов

### 2. `fix-kubernetes-scheduling.sh` - Исправление планирования подов

Диагностирует и исправляет проблемы с планированием подов maximus и redis.

**Использование:**
```bash
./scripts/fix-kubernetes-scheduling.sh
```

**Что делает:**
- Проверяет состояние scheduler
- Проверяет состояние целевого узла (canton-node-65-108-15-30)
- Проверяет поды в namespace maximus
- Удаляет зависшие Pending поды
- Обновляет nodeSelector в deployments
- Перезапускает deployments для пересоздания подов
- Сохраняет детальные отчеты в `/tmp/k8s-fix-YYYYMMDD-HHMMSS/`

### 3. `fix-node-disk-capacity.sh` - Исправление InvalidDiskCapacity

Обрабатывает проблему InvalidDiskCapacity на узле.

**Использование:**
```bash
./scripts/fix-node-disk-capacity.sh
```

**Что делает:**
- Проверяет состояние узла
- Предоставляет инструкции по исправлению проблемы
- Выводит команды для выполнения на узле

**Примечание:** Для полного исправления может потребоваться SSH доступ к узлу.

### 4. `check-sites-availability.sh` - Проверка доступности сайтов

Проверяет доступность всех трех сайтов и их конфигурации.

**Использование:**
```bash
./scripts/check-sites-availability.sh
```

**Что делает:**
- Проверяет HTTP статус сайтов
- Проверяет редирект HTTP → HTTPS
- Проверяет сертификаты
- Проверяет ingress конфигурации
- Проверяет endpoints и поды

**Проверяемые сайты:**
- gyber.org (namespace: default)
- 1otc.cc (namespace: canton-otc)
- maximus-marketing-swarm.gyber.org (namespace: maximus)

## Проблемы, которые решают скрипты

### Приоритет 1: КРИТИЧНО

1. **Планирование подов maximus и redis**
   - Поды в Pending 18+ минут без событий от scheduler
   - Скрипт удаляет зависшие поды и перезапускает deployments

2. **Работа Redis для maximus**
   - Без Redis приложение падает
   - Скрипт перезапускает Redis deployment

### Приоритет 2: ВАЖНО

3. **Доступность всех трех сайтов**
   - Проверка через curl
   - Проверка HTTPS сертификатов
   - Проверка редиректов HTTP → HTTPS

4. **Предупреждение InvalidDiskCapacity**
   - Предоставляет инструкции по исправлению
   - Может потребоваться ручное вмешательство

## Требования

- Доступ к Kubernetes кластеру (kubectl настроен)
- Права на выполнение операций в кластере
- Для полного исправления InvalidDiskCapacity - SSH доступ к узлу

## Отчеты

Скрипты сохраняют детальные отчеты в:
- `/tmp/k8s-fix-YYYYMMDD-HHMMSS/` - отчеты от fix-kubernetes-scheduling.sh
  - `node-description.txt` - детальное описание узла
  - `node-events.txt` - события узла
  - `pod-*-describe.txt` - описание каждого пода
  - `maximus-deployment.yaml` - конфигурация deployment maximus
  - `redis-deployment.yaml` - конфигурация deployment redis

## Ручное исправление InvalidDiskCapacity

Если автоматическое исправление не помогло, выполните на узле:

```bash
# Подключение к узлу
ssh root@65.108.15.30

# Проверка дискового пространства
df -h

# Очистка неиспользуемых образов
k3s crictl rmi --prune

# Перезапуск kubelet
systemctl restart k3s-agent

# Проверка логов
journalctl -u k3s-agent -n 100
```

## Устранение неполадок

### Поды все еще в Pending

1. Проверьте логи scheduler:
   ```bash
   kubectl logs -n kube-system -l component=kube-scheduler --tail=100
   ```

2. Проверьте детали пода:
   ```bash
   kubectl describe pod <pod-name> -n maximus
   ```

3. Проверьте события:
   ```bash
   kubectl get events -n maximus --sort-by='.lastTimestamp'
   ```

### Сайты недоступны

1. Проверьте ingress:
   ```bash
   kubectl get ingress -A
   kubectl describe ingress <ingress-name> -n <namespace>
   ```

2. Проверьте сертификаты:
   ```bash
   kubectl get certificates -A
   kubectl describe certificate <cert-name> -n <namespace>
   ```

3. Проверьте endpoints:
   ```bash
   kubectl get endpoints -n <namespace>
   ```

## Дополнительная информация

Все детали проблем описаны в файле `docs/infrastructure/KUBERNETES_CLUSTER_FIX_PROMPT.md`.

Конфигурации сохранены в `/tmp/`:
- `/tmp/maximus-pods.yaml`
- `/tmp/maximus-deployment.yaml`
- `/tmp/redis-deployment.yaml`
- `/tmp/ingress-configs.yaml`
- `/tmp/certificates.yaml`
