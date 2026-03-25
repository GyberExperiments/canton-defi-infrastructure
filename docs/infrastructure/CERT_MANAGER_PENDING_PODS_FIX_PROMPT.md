# ПРОМПТ ДЛЯ ИСПРАВЛЕНИЯ ПРОБЛЕМЫ CERT-MANAGER И ПЕРЕГРУЗКИ SCHEDULER

## КОНТЕКСТ ПРОБЛЕМЫ

В Kubernetes кластере (K3s) обнаружена критическая проблема:
- **8000+ Pending подов** в namespace `platform-gyber-org`
- Все поды - это `cm-acme-http-solver-*` от cert-manager
- Scheduler перегружен и не может планировать новые поды
- Блокируется планирование подов `maximus` и `redis` в namespace `maximus`

## ЧТО БЫЛО СДЕЛАНО

### ✅ Выполнено

1. **Созданы скрипты для диагностики:**
   - `fix-kubernetes-cluster-complete.sh` - главный скрипт
   - `fix-kubernetes-scheduling.sh` - диагностика планирования
   - `check-sites-availability.sh` - проверка сайтов
   - `cleanup-pending-pods-api.sh` - попытка очистки подов

2. **Диагностика показала:**
   - Узел `canton-node-65-108-15-30` в статусе Ready
   - Ресурсов достаточно (CPU 70%, Memory 31%)
   - nodeSelector настроен правильно
   - Проблема НЕ в узле, а в перегрузке scheduler

3. **Попытки исправления:**
   - Удаление Pending подов через `kubectl delete` - **ЗАВИСАЕТ** (команда выполняется 5+ минут)
   - Массовое удаление через API - **НЕ РАБОТАЕТ** (команды зависают)
   - Поды продолжают создаваться cert-manager

### ❌ Проблемы

1. **Команды зависают:**
   - `kubectl delete pods --field-selector=status.phase=Pending` зависает на 5+ минут
   - `kubectl describe pod` на Pending подах зависает
   - Любые операции с большим количеством подов блокируются

2. **Cert-manager создает поды быстрее, чем их можно удалить:**
   - Новые поды создаются каждые несколько минут
   - Количество Pending подов растет (было 7571, стало 8028, затем 8031)

3. **Scheduler не может обработать очередь:**
   - 8000+ Pending подов в очереди scheduler
   - Новые поды не могут быть запланированы
   - Даже с правильным nodeSelector поды остаются в Pending

## АНАЛИЗ ПРОБЛЕМЫ

### Почему cert-manager создает столько подов?

**Гипотезы:**
1. Cert-manager пытается получить сертификат для домена, но challenge не может быть выполнен
2. Challenge поды не могут быть запланированы из-за перегрузки scheduler
3. Cert-manager создает новые поды, когда старые не планируются
4. Возможно проблема с конфигурацией Certificate или Challenge ресурсов

### Почему поды не могут быть запланированы?

**Возможные причины:**
1. **Перегрузка scheduler** - 8000+ подов в очереди блокируют обработку
2. **Проблема с узлами** - но диагностика показала, что узлы в порядке
3. **Проблема с ресурсами** - но ресурсов достаточно
4. **Проблема с nodeSelector/taints** - но для cert-manager подов nodeSelector не задан

### Почему команды зависают?

**Причины:**
1. Kubernetes API перегружен запросами на 8000+ подов
2. etcd перегружен из-за большого количества объектов
3. Scheduler пытается обработать все поды при каждом запросе
4. Сетевые задержки при работе с большим количеством объектов

## ЗАДАЧИ ДЛЯ РЕШЕНИЯ

### Приоритет 1: КРИТИЧНО

1. **Остановить создание новых challenge подов cert-manager**
   - Найти и исправить проблему с Certificate/Challenge ресурсами
   - Временно приостановить cert-manager, если необходимо
   - Настроить правильную очистку старых challenge подов

2. **Очистить существующие Pending поды эффективным методом**
   - Найти способ удаления, который не зависает
   - Возможно через прямой доступ к etcd или API с батчами
   - Или через удаление Challenge ресурсов, которые создают поды

3. **Разблокировать scheduler**
   - После очистки подождать стабилизации scheduler
   - Проверить планирование подов maximus и redis

### Приоритет 2: ВАЖНО

4. **Исправить конфигурацию cert-manager**
   - Настроить правильную очистку challenge подов
   - Ограничить количество одновременных challenge
   - Настроить таймауты для challenge

5. **Проверить и исправить Certificate ресурсы**
   - Найти проблемные Certificate ресурсы
   - Исправить или удалить их
   - Убедиться, что challenge могут быть выполнены

## ПЛАН ДЕЙСТВИЙ

### Шаг 1: Исследование cert-manager

```bash
# Проверить Certificate ресурсы
kubectl get certificates -A
kubectl get challenges -A

# Проверить конфигурацию cert-manager
kubectl get deployment -n cert-manager
kubectl get configmap -n cert-manager

# Проверить логи cert-manager
kubectl logs -n cert-manager -l app=cert-manager --tail=100
```

### Шаг 2: Остановка создания новых подов

**Варианты:**
1. Временно приостановить cert-manager:
   ```bash
   kubectl scale deployment cert-manager -n cert-manager --replicas=0
   ```

2. Удалить проблемные Certificate ресурсы:
   ```bash
   kubectl get certificates -A -o json | jq -r '.items[] | select(.status.conditions[]?.reason=="Pending") | "\(.metadata.namespace)/\(.metadata.name)"'
   ```

3. Удалить все Challenge ресурсы:
   ```bash
   kubectl delete challenges -A --all
   ```

### Шаг 3: Эффективная очистка Pending подов

**Методы (от наиболее эффективного):**

1. **Удаление через Challenge ресурсы** (РЕКОМЕНДУЕТСЯ):
   ```bash
   # Удаляем Challenge, поды удалятся автоматически
   kubectl delete challenges -A --all --grace-period=0
   ```

2. **Удаление через API с батчами и таймаутами:**
   ```bash
   # Получаем список подов и удаляем батчами по 100
   kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' | \
     tr ' ' '\n' | split -l 100 | \
     while read batch; do
       echo "$batch" | xargs -P 5 -I {} kubectl delete pod {} -n platform-gyber-org --grace-period=0 --force --timeout=2s 2>&1 | grep -v "Warning" || true
       sleep 1
     done
   ```

3. **Прямое удаление через etcd** (только если другие методы не работают):
   - Требует доступа к etcd
   - Опасно, использовать только в крайнем случае

### Шаг 4: Проверка и исправление планирования

```bash
# Проверить состояние scheduler
kubectl get events -A --sort-by='.lastTimestamp' | grep -i scheduler | tail -20

# Проверить планирование подов maximus
kubectl get pods -n maximus -o wide
kubectl describe pod -n maximus maximus-d5b448c5f-9v7n2

# Перезапустить deployments после очистки
kubectl rollout restart deployment maximus -n maximus
kubectl rollout restart deployment redis -n maximus
```

### Шаг 5: Настройка cert-manager

```bash
# Проверить конфигурацию cert-manager
kubectl get configmap -n cert-manager cert-manager-controller -o yaml

# Настроить правильную очистку challenge подов
# Добавить в ConfigMap:
# cleanupOnSuccess: true
# cleanupOnFailure: true
```

## КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

```bash
# 1. Проверить Certificate ресурсы
kubectl get certificates -A -o wide
kubectl describe certificate -n platform-gyber-org <cert-name>

# 2. Проверить Challenge ресурсы
kubectl get challenges -A
kubectl describe challenge -n platform-gyber-org <challenge-name>

# 3. Проверить логи cert-manager
kubectl logs -n cert-manager -l app=cert-manager --tail=200 | grep -i "challenge\|error\|pending"

# 4. Проверить количество Pending подов
kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l

# 5. Проверить состояние scheduler
kubectl get events -A --field-selector reason=FailedScheduling --sort-by='.lastTimestamp' | tail -20
```

## ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
- ✅ Количество Pending подов уменьшилось до <100
- ✅ Cert-manager не создает новые поды без необходимости
- ✅ Scheduler может планировать новые поды
- ✅ Поды maximus и redis запланированы и запущены
- ✅ Сайты доступны

## ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **НЕ удалять поды по одному** - это слишком медленно и перегружает API
2. **Удалять через Challenge ресурсы** - это правильный способ, поды удалятся автоматически
3. **Остановить cert-manager перед массовой очисткой** - чтобы не создавались новые поды
4. **Проверить Certificate ресурсы** - возможно проблема в их конфигурации
5. **Настроить cert-manager правильно** - чтобы challenge поды удалялись автоматически

## ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

### Структура проблемы:
```
Certificate ресурс → Challenge ресурс → Pod (cm-acme-http-solver-*)
                                      ↓
                                  Pending (не может быть запланирован)
                                      ↓
                                  Cert-manager создает новый Challenge
                                      ↓
                                  Новый Pod → Pending
                                      ↓
                                  Цикл повторяется
```

### Решение:
1. Удалить Challenge ресурсы → поды удалятся автоматически
2. Исправить Certificate ресурсы → новые Challenge не будут создаваться
3. Настроить cert-manager → правильная очистка challenge подов

## ФАЙЛЫ ДЛЯ АНАЛИЗА

Все скрипты сохранены в:
- `scripts/fix-kubernetes-cluster-complete.sh`
- `scripts/fix-kubernetes-scheduling.sh`
- `scripts/cleanup-pending-pods-api.sh`
- `KUBERNETES_FIX_REPORT.md`

## КРИТИЧЕСКИЕ КОМАНДЫ

```bash
# 1. Остановить cert-manager (временно)
kubectl scale deployment cert-manager -n cert-manager --replicas=0

# 2. Удалить все Challenge ресурсы (это удалит поды автоматически)
kubectl delete challenges -A --all --grace-period=0

# 3. Проверить результат
kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l

# 4. После очистки - проверить планирование
kubectl get pods -n maximus -o wide

# 5. Перезапустить deployments
kubectl rollout restart deployment maximus -n maximus
kubectl rollout restart deployment redis -n maximus
```

---

**Используй этот промпт для глубокого анализа проблемы и её решения.**
**Фокус на:**
1. Почему cert-manager создает столько подов
2. Почему поды не могут быть запланированы
3. Как эффективно очистить Pending поды
4. Как предотвратить проблему в будущем
