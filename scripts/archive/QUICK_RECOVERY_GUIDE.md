# 🚀 БЫСТРОЕ ВОССТАНОВЛЕНИЕ КЛАСТЕРА

## Автоматизированное восстановление

Создан мастер-скрипт `complete-cluster-recovery.sh`, который автоматизирует все 7 этапов восстановления из `docs/infrastructure/COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT.md`.

### Использование

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/complete-cluster-recovery.sh
```

### Что делает скрипт

1. **ЭТАП 1: Радикальная очистка**
   - Запускает `radical-cleanup-final.sh`
   - Удаляет все Challenge, CertificateRequest, Order
   - Удаляет все Pending поды
   - Очищает finalizers

2. **ЭТАП 2: Удаление зависшего узла**
   - Удаляет все поды с узла `canton-node-65-108-15-30`
   - Удаляет узел из кластера
   - Очищает связанные PVC

3. **ЭТАП 3: Обеззараживание**
   - Проверяет подозрительные поды и удаляет их
   - Проверяет внешние сервисы
   - Проверяет RBAC
   - Очищает старые сертификаты

4. **ЭТАП 4: Настройка cert-manager**
   - Применяет правильную конфигурацию
   - Устанавливает лимиты ресурсов
   - Перезапускает все компоненты

5. **ЭТАП 5: Исправление конфигураций**
   - Исправляет ingress конфигурации
   - Применяет исправленные ingress
   - Унифицирует ClusterIssuer

6. **ЭТАП 6: Восстановление проектов**
   - Проверяет статус deployments
   - Перезапускает проблемные deployments
   - Проверяет планирование подов

7. **ЭТАП 7: Мониторинг**
   - Создает CronJob для автоматической очистки

### Ручное выполнение (если нужно)

Если нужно выполнить этапы вручную, смотрите `docs/infrastructure/COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT.md`.

### Проверка после восстановления

```bash
# Статистика кластера
kubectl get pods -A --field-selector status.phase=Pending --no-headers | wc -l
kubectl top node tmedm

# Проверка сайтов
curl -I https://gyber.org
curl -I https://1otc.cc
curl -I https://maximus-marketing-swarm.gyber.org

# Проверка узлов
kubectl get nodes
```

### Важные замечания

- ⚠️ Скрипт запросит подтверждение перед выполнением
- ⚠️ Выполнение может занять 10-30 минут
- ⚠️ Рекомендуется сделать backup перед запуском
- ✅ Скрипт безопасен и проверяет каждое действие
