# Исправление проблемы cert-manager и разблокировка scheduler

## Описание

Скрипт `fix-cert-manager-complete.sh` решает критическую проблему с cert-manager, когда создается 8000+ Pending подов `cm-acme-http-solver-*`, что перегружает scheduler и блокирует планирование новых подов.

## Проблема

**Симптомы:**
- 8000+ Pending подов `cm-acme-http-solver-*` в namespace `platform-gyber-org`
- Scheduler перегружен и не может планировать новые поды
- Поды `maximus` и `redis` в namespace `maximus` не могут быть запланированы
- Команды `kubectl` зависают при работе с большим количеством подов

**Корневая причина:**
1. Cert-manager создает Challenge для получения сертификата
2. Challenge создает Pod для HTTP-01 challenge
3. Pod не может быть запланирован (scheduler перегружен)
4. Challenge не может быть выполнен
5. Cert-manager создает новый Challenge (старый не удаляется)
6. Цикл повторяется → 8000+ Pending подов

## Использование

### Базовое использование

```bash
./scripts/fix-cert-manager-complete.sh
```

### С указанием namespace

```bash
./scripts/fix-cert-manager-complete.sh platform-gyber-org
```

## Что делает скрипт

### Шаг 1: Остановка cert-manager
- Временно останавливает cert-manager deployment
- Прерывает цикл создания новых подов

### Шаг 2: Удаление Challenge ресурсов
- Удаляет все Challenge ресурсы (правильный способ)
- Поды удаляются автоматически при удалении Challenge

### Шаг 3: Удаление оставшихся Pending подов
- Массовое удаление через kubectl
- Если осталось много подов - удаление батчами по 500

### Шаг 4: Проверка Certificate ресурсов
- Находит проблемные Certificate ресурсы
- Показывает детали для ручной проверки

### Шаг 5: Настройка cert-manager
- Настраивает автоматическую очистку challenge подов
- Ограничивает количество одновременных challenge (max-concurrent-challenges=5)

### Шаг 6: Восстановление cert-manager
- Запускает cert-manager обратно

### Шаг 7: Проверка планирования подов
- Ожидает стабилизации scheduler (5 минут)
- Проверяет планирование подов maximus и redis
- Перезапускает deployments при необходимости

## Требования

- `kubectl` - должен быть установлен и настроен
- `jq` - опционально (для анализа Certificate ресурсов)
- Доступ к Kubernetes кластеру

## Ожидаемый результат

После выполнения:
- ✅ Количество Pending подов < 100
- ✅ Cert-manager не создает новые поды без необходимости
- ✅ Scheduler может планировать новые поды
- ✅ Поды maximus и redis запланированы и запущены
- ✅ Endpoints настроены правильно

## Важные замечания

1. **НЕ удалять поды по одному** - это слишком медленно и перегружает API
2. **Удалять через Challenge ресурсы** - это правильный способ, поды удалятся автоматически
3. **Остановить cert-manager перед очисткой** - чтобы не создавались новые поды
4. **Проверить Certificate ресурсы** - возможно проблема в их конфигурации
5. **Настроить cert-manager правильно** - чтобы challenge поды удалялись автоматически
6. **Подождать после очистки** - scheduler нужно время для стабилизации

## Дополнительная диагностика

Если проблема не решается:

```bash
# Проверить логи cert-manager
kubectl logs -n cert-manager -l app=cert-manager --tail=200 | grep -i "challenge\|error\|pending"

# Проверить события scheduler
kubectl get events -A --field-selector reason=FailedScheduling --sort-by='.lastTimestamp' | tail -20

# Проверить Certificate ресурсы
kubectl get certificates -A
kubectl describe certificate -n platform-gyber-org <cert-name>
```

## Связанные файлы

- `../docs/infrastructure/FINAL_CERT_MANAGER_FIX_PROMPT.md` - детальный промпт с анализом проблемы
- `../docs/infrastructure/CERT_MANAGER_PENDING_PODS_FIX_PROMPT.md` - предыдущий анализ
- `../docs/infrastructure/CERT_MANAGER_ROOT_CAUSE_ANALYSIS.md` - анализ корневой причины
- `cleanup-pending-pods-api.sh` - альтернативный скрипт для очистки подов

## Автор

Скрипт создан на основе `docs/infrastructure/FINAL_CERT_MANAGER_FIX_PROMPT.md` и следует всем рекомендациям best practices.
