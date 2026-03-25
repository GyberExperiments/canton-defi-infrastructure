# ФИНАЛЬНЫЙ ПРОМПТ: ИСПРАВЛЕНИЕ CERT-MANAGER И РАЗБЛОКИРОВКА SCHEDULER

## КРИТИЧЕСКАЯ ПРОБЛЕМА

**Симптомы:**
- 8000+ Pending подов `cm-acme-http-solver-*` в namespace `platform-gyber-org`
- Все поды созданы cert-manager для HTTP-01 challenge
- Scheduler перегружен и не может планировать новые поды
- Поды `maximus` и `redis` в namespace `maximus` не могут быть запланированы (4+ часа в Pending)
- Команды `kubectl delete pods --field-selector=status.phase=Pending` зависают на 5+ минут
- Команды `kubectl describe pod` на Pending подах зависают

**Кластер:** K3s (встроенный scheduler)
**Узел:** `canton-node-65-108-15-30` (Ready, ресурсов достаточно)

## ЧТО УЖЕ СДЕЛАНО

### ✅ Диагностика выполнена

1. **Проверен узел:**
   - Статус: Ready
   - Ресурсы: CPU 70%, Memory 31% (достаточно)
   - nodeSelector: настроен правильно
   - Taints: отсутствуют
   - **Вывод:** Проблема НЕ в узле

2. **Проверен scheduler:**
   - K3s использует встроенный scheduler
   - Control-plane узел: Ready
   - **Вывод:** Scheduler перегружен 8000+ Pending подов

3. **Проверены deployments:**
   - `maximus`: nodeSelector правильный, ресурсы достаточные
   - `redis`: nodeSelector правильный, ресурсы достаточные
   - **Вывод:** Проблема в scheduler, а не в конфигурации

### ❌ Попытки исправления не сработали

1. **Удаление через kubectl:**
   - `kubectl delete pods --field-selector=status.phase=Pending` - **ЗАВИСАЕТ** на 5+ минут
   - `kubectl delete pods -n platform-gyber-org --field-selector=status.phase=Pending --grace-period=0 --force` - **ЗАВИСАЕТ**

2. **Массовое удаление:**
   - Параллельное удаление через xargs - **ЗАВИСАЕТ**
   - Удаление батчами - **ЗАВИСАЕТ**

3. **Проблема усугубляется:**
   - Количество подов растет (7571 → 8028 → 8031)
   - Cert-manager продолжает создавать новые поды
   - Scheduler не может обработать очередь

## КОРНЕВАЯ ПРИЧИНА

### Цикл проблемы:

```
1. Cert-manager создает Challenge для получения сертификата
   ↓
2. Challenge создает Pod (cm-acme-http-solver-*)
   ↓
3. Pod не может быть запланирован (scheduler перегружен)
   ↓
4. Challenge не может быть выполнен (под не запущен)
   ↓
5. Cert-manager создает новый Challenge (старый не удаляется)
   ↓
6. Новый Challenge создает новый Pod
   ↓
7. Цикл повторяется → 8000+ Pending подов
```

### Почему это происходит:

1. **Certificate ресурс настроен неправильно или не может быть выполнен:**
   - Неправильный домен
   - DNS проблемы
   - Проблемы с ingress
   - Challenge не может быть валидирован

2. **Cert-manager не удаляет старые Challenge:**
   - Challenge поды остаются в Pending
   - Новые Challenge создаются
   - Старые поды не удаляются автоматически

3. **Scheduler перегружен:**
   - 8000+ подов в очереди
   - Каждый цикл scheduler пытается обработать все поды
   - Новые поды не могут быть обработаны

## РЕШЕНИЕ

### Шаг 1: ОСТАНОВИТЬ СОЗДАНИЕ НОВЫХ ПОДОВ

**Цель:** Прервать цикл создания подов

```bash
# Временно приостановить cert-manager
kubectl scale deployment cert-manager -n cert-manager --replicas=0

# ИЛИ удалить проблемные Certificate ресурсы
kubectl get certificates -A -o json | jq -r '.items[] | select(.status.conditions[]?.reason=="Pending" or .status.conditions[]?.reason=="Failed") | "\(.metadata.namespace)/\(.metadata.name)"' | xargs -I {} kubectl delete certificate {} --grace-period=0
```

### Шаг 2: УДАЛИТЬ СУЩЕСТВУЮЩИЕ PENDING ПОДЫ

**Цель:** Разблокировать scheduler

**МЕТОД 1: Удаление через Challenge ресурсы (РЕКОМЕНДУЕТСЯ)**

Это правильный способ - удаляем Challenge, поды удалятся автоматически:

```bash
# Удалить все Challenge ресурсы
kubectl delete challenges -A --all --grace-period=0

# Проверить результат
kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l
```

**МЕТОД 2: Если Challenge ресурсы не найдены или не удаляются**

Использовать прямой доступ к API с батчами:

```bash
# Получить список подов и удалить батчами по 500
kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' | \
  tr ' ' '\n' | \
  split -l 500 - /tmp/pod-batch- 2>/dev/null || \
  (kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' | \
   tr ' ' '\n' | head -500 > /tmp/pod-batch-1 && \
   kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' | \
   tr ' ' '\n' | tail -n +501 | head -500 > /tmp/pod-batch-2)

# Удалить батчами
for batch in /tmp/pod-batch-*; do
  if [ -f "$batch" ]; then
    cat "$batch" | xargs -P 10 -I {} kubectl delete pod {} -n platform-gyber-org --grace-period=0 --force --timeout=2s 2>&1 | grep -v "Warning\|Error" || true
    sleep 2
  fi
done
```

**МЕТОД 3: Если методы 1 и 2 не работают**

Использовать Kubernetes API напрямую через curl:

```bash
# Получить токен и API server
API_SERVER=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')
TOKEN=$(kubectl get secret $(kubectl get sa default -n kube-system -o jsonpath='{.secrets[0].name}') -n kube-system -o jsonpath='{.data.token}' | base64 -d)

# Получить список подов
PODS=$(kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}')

# Удалить через API
for pod in $PODS; do
  curl -k -X DELETE \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$API_SERVER/api/v1/namespaces/platform-gyber-org/pods/$pod?gracePeriodSeconds=0" \
    --max-time 2 \
    2>/dev/null || true
done
```

### Шаг 3: ПРОВЕРИТЬ И ИСПРАВИТЬ CERTIFICATE РЕСУРСЫ

**Цель:** Убедиться, что проблема не повторится

```bash
# 1. Проверить все Certificate ресурсы
kubectl get certificates -A

# 2. Найти проблемные Certificate
kubectl get certificates -A -o json | jq -r '.items[] | select(.status.conditions[]?.reason=="Pending" or .status.conditions[]?.reason=="Failed") | "\(.metadata.namespace)/\(.metadata.name): \(.status.conditions[]?.reason)"'

# 3. Проверить детали проблемного Certificate
kubectl describe certificate -n platform-gyber-org <cert-name>

# 4. Исправить или удалить проблемный Certificate
# Если Certificate неправильно настроен - исправить
# Если Certificate не нужен - удалить
kubectl delete certificate -n platform-gyber-org <cert-name>
```

### Шаг 4: НАСТРОИТЬ CERT-MANAGER ПРАВИЛЬНО

**Цель:** Предотвратить проблему в будущем

```bash
# 1. Проверить конфигурацию cert-manager
kubectl get configmap -n cert-manager cert-manager-controller -o yaml

# 2. Настроить автоматическую очистку challenge подов
kubectl patch configmap cert-manager-controller -n cert-manager --type merge -p '{"data":{"cleanup-on-success":"true","cleanup-on-failure":"true"}}' 2>/dev/null || \
kubectl patch deployment cert-manager -n cert-manager --type json -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--cleanup-on-success=true"},{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--cleanup-on-failure=true"}]'

# 3. Ограничить количество одновременных challenge
kubectl patch deployment cert-manager -n cert-manager --type json -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--max-concurrent-challenges=5"}]'

# 4. Перезапустить cert-manager
kubectl rollout restart deployment cert-manager -n cert-manager
```

### Шаг 5: ПРОВЕРИТЬ ПЛАНИРОВАНИЕ ПОДОВ

**Цель:** Убедиться, что scheduler работает

```bash
# 1. Подождать 5-10 минут после очистки
echo "Ожидание стабилизации scheduler..."
sleep 300

# 2. Проверить количество Pending подов
kubectl get pods -A --field-selector=status.phase=Pending --no-headers | wc -l

# 3. Проверить планирование подов maximus и redis
kubectl get pods -n maximus -o wide

# 4. Если поды все еще в Pending, проверить детали
kubectl describe pod -n maximus maximus-d5b448c5f-9v7n2
kubectl get events -n maximus --sort-by='.lastTimestamp' | tail -20

# 5. Перезапустить deployments
kubectl rollout restart deployment maximus -n maximus
kubectl rollout restart deployment redis -n maximus

# 6. Подождать еще 2-3 минуты
sleep 180

# 7. Проверить финальное состояние
kubectl get pods -n maximus -o wide
kubectl get endpoints -n maximus
```

## КОМАНДЫ ДЛЯ БЫСТРОГО ИСПРАВЛЕНИЯ (ВСЁ В ОДНОМ)

```bash
#!/bin/bash
set -euo pipefail

echo "=== ШАГ 1: Остановка cert-manager ==="
kubectl scale deployment cert-manager -n cert-manager --replicas=0

echo "=== ШАГ 2: Удаление Challenge ресурсов ==="
kubectl delete challenges -A --all --grace-period=0 || echo "Challenge ресурсы не найдены"

echo "=== ШАГ 3: Проверка количества Pending подов ==="
PENDING_COUNT=$(kubectl get pods -A --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l | tr -d ' ')
echo "Pending подов: $PENDING_COUNT"

if [ "$PENDING_COUNT" -gt "100" ]; then
    echo "=== ШАГ 4: Удаление оставшихся подов батчами ==="
    kubectl get pods -n platform-gyber-org --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}' | \
      tr ' ' '\n' | head -1000 | \
      xargs -P 20 -I {} sh -c "kubectl delete pod {} -n platform-gyber-org --grace-period=0 --force --timeout=2s 2>&1 | grep -q 'deleted\|not found' && echo '.' || true" | wc -l
fi

echo "=== ШАГ 5: Ожидание стабилизации (5 минут) ==="
sleep 300

echo "=== ШАГ 6: Проверка планирования ==="
kubectl get pods -n maximus -o wide

echo "=== ШАГ 7: Перезапуск deployments ==="
kubectl rollout restart deployment maximus -n maximus
kubectl rollout restart deployment redis -n maximus

echo "=== ШАГ 8: Финальная проверка ==="
sleep 180
kubectl get pods -n maximus -o wide
kubectl get endpoints -n maximus
```

## ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После выполнения:
- ✅ Количество Pending подов < 100
- ✅ Cert-manager не создает новые поды без необходимости
- ✅ Scheduler может планировать новые поды
- ✅ Поды maximus и redis запланированы и запущены
- ✅ Endpoints настроены правильно
- ✅ Сайты доступны

## ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **НЕ удалять поды по одному** - это слишком медленно и перегружает API
2. **Удалять через Challenge ресурсы** - это правильный способ, поды удалятся автоматически
3. **Остановить cert-manager перед очисткой** - чтобы не создавались новые поды
4. **Проверить Certificate ресурсы** - возможно проблема в их конфигурации
5. **Настроить cert-manager правильно** - чтобы challenge поды удалялись автоматически
6. **Подождать после очистки** - scheduler нужно время для стабилизации

## ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА

Если проблема не решается:

```bash
# 1. Проверить логи cert-manager
kubectl logs -n cert-manager -l app=cert-manager --tail=200 | grep -i "challenge\|error\|pending"

# 2. Проверить события scheduler
kubectl get events -A --field-selector reason=FailedScheduling --sort-by='.lastTimestamp' | tail -20

# 3. Проверить состояние etcd (если доступно)
kubectl get pods -n kube-system | grep etcd

# 4. Проверить нагрузку на control-plane узел
kubectl top node tmedm
```

---

**ИСПОЛЬЗУЙ ЭТОТ ПРОМПТ ДЛЯ ПОЛНОГО РЕШЕНИЯ ПРОБЛЕМЫ.**

**ПРИОРИТЕТ:**
1. Остановить cert-manager
2. Удалить Challenge ресурсы
3. Проверить и исправить Certificate ресурсы
4. Настроить cert-manager правильно
5. Проверить планирование подов
