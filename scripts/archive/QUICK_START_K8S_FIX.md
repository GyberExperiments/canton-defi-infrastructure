# Быстрый старт: Исправление проблем Kubernetes кластера

## Запуск исправления

Выполните главный скрипт:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/fix-kubernetes-cluster-complete.sh
```

Скрипт автоматически:
1. ✅ Исправит проблемы с планированием подов maximus и redis
2. ✅ Обработает проблему InvalidDiskCapacity
3. ✅ Проверит доступность всех трех сайтов

## Что делать после запуска

### Если поды все еще в Pending

1. Проверьте отчеты в `/tmp/k8s-fix-YYYYMMDD-HHMMSS/`
2. Проверьте логи scheduler (если доступны):
   ```bash
   kubectl logs -n kube-system -l component=kube-scheduler --tail=100
   ```
3. Проверьте события:
   ```bash
   kubectl get events -n maximus --sort-by='.lastTimestamp' | tail -20
   ```

### Если сайты недоступны

1. Проверьте ingress:
   ```bash
   kubectl get ingress -A
   ```
2. Проверьте сертификаты:
   ```bash
   kubectl get certificates -A
   ```
3. Проверьте поды:
   ```bash
   kubectl get pods -n maximus -o wide
   kubectl get pods -n default -o wide
   kubectl get pods -n canton-otc -o wide
   ```

### Если InvalidDiskCapacity не исправлен

Требуется SSH доступ к узлу:

```bash
ssh root@65.108.15.30
systemctl restart k3s-agent
k3s crictl rmi --prune
```

## Отдельные скрипты

Если нужно запустить только определенную проверку:

```bash
# Только планирование подов
./scripts/fix-kubernetes-scheduling.sh

# Только проверка InvalidDiskCapacity
./scripts/fix-node-disk-capacity.sh

# Только проверка сайтов
./scripts/check-sites-availability.sh
```

## Ожидаемый результат

После успешного выполнения:
- ✅ Все поды maximus и redis в статусе Running
- ✅ Endpoints настроены и указывают на работающие поды
- ✅ Все три сайта доступны через HTTPS
- ✅ Сертификаты действительны

## Дополнительная информация

Подробная документация: `scripts/KUBERNETES_FIX_README.md`

Описание проблем: `docs/infrastructure/KUBERNETES_CLUSTER_FIX_PROMPT.md`
