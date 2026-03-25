# 🚀 РУКОВОДСТВО ПО ИСПРАВЛЕНИЮ ПРОБЛЕМ С KUBERNETES КЛАСТЕРОМ

## 📋 КРАТКОЕ ОПИСАНИЕ ПРОБЛЕМ

1. **gyber.org** - ИСПРАВЛЕНО, требуется проверка
2. **1otc.cc** - ИСПРАВЛЕНО, требуется проверка  
3. **maximus-marketing-swarm.gyber.org** - КРИТИЧЕСКАЯ ПРОБЛЕМА: поды не могут быть запланированы

## 🔧 БЫСТРОЕ РЕШЕНИЕ

### Шаг 1: Исправление планирования подов maximus и redis

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/fix-maximus-scheduling-complete.sh
```

Этот скрипт:
- ✅ Проверяет состояние узла и scheduler
- ✅ Очищает старые Pending поды (если их слишком много)
- ✅ Исправляет проблемы с nodeSelector
- ✅ Пробует альтернативные методы планирования (nodeAffinity)
- ✅ Перезапускает deployments
- ✅ Проверяет доступность сайтов

### Шаг 2: Проверка доступности всех сайтов

```bash
./scripts/verify-all-sites.sh
```

Этот скрипт проверяет:
- ✅ HTTPS доступность
- ✅ HTTP → HTTPS редирект
- ✅ SSL сертификаты
- ✅ Ingress конфигурации
- ✅ Endpoints
- ✅ Состояние подов

## 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА

### Проверка состояния подов maximus

```bash
kubectl get pods -n maximus -o wide
kubectl describe pod <pod-name> -n maximus
```

### Проверка событий scheduler

```bash
# В K3s scheduler встроен в control-plane
kubectl get events -n maximus --sort-by='.lastTimestamp'
kubectl get events --all-namespaces --field-selector involvedObject.kind=Pod | grep maximus
```

### Проверка узла

```bash
kubectl describe node canton-node-65-108-15-30
kubectl top node canton-node-65-108-15-30
```

### Проверка предупреждения InvalidDiskCapacity

Если предупреждение `InvalidDiskCapacity` блокирует планирование:

```bash
# На узле (требуется SSH доступ)
ssh root@65.108.15.30
systemctl restart k3s-agent
k3s crictl rmi --prune  # Очистка неиспользуемых образов
```

## 🎯 РЕШЕНИЕ КОНКРЕТНЫХ ПРОБЛЕМ

### Проблема: Поды в Pending без событий от scheduler

**Причины:**
1. Scheduler перегружен (много Pending подов в кластере)
2. Проблема с узлом (InvalidDiskCapacity)
3. Проблема с nodeSelector/taints

**Решение:**
1. Запустить `fix-maximus-scheduling-complete.sh` - он автоматически:
   - Очистит старые Pending поды
   - Временно уберет nodeSelector для проверки
   - Попробует nodeAffinity
   - Если не поможет - уберет привязку к узлу полностью

### Проблема: Redis не работает, приложение падает

**Решение:**
1. Сначала исправить планирование подов (см. выше)
2. После того как redis под запустится, приложение должно заработать

### Проблема: Сайт недоступен через HTTPS

**Проверка:**
```bash
# Проверка ingress
kubectl get ingress -n <namespace>

# Проверка сертификата
kubectl get certificates -n <namespace>

# Проверка endpoints
kubectl get endpoints -n <namespace>
```

**Решение:**
- Если ingress не настроен - применить конфигурацию
- Если сертификат не готов - подождать или пересоздать
- Если нет endpoints - проверить поды и service

## 📊 МОНИТОРИНГ

### Проверка использования ресурсов

```bash
kubectl top nodes
kubectl top pods --all-namespaces
```

### Проверка состояния кластера

```bash
kubectl get nodes -o wide
kubectl get pods --all-namespaces | grep -E "Pending|CrashLoopBackOff|Error"
```

## 🚨 КРИТИЧЕСКИЕ ДЕЙСТВИЯ

### Если скрипт не помог

1. **Проверить логи scheduler:**
   ```bash
   # В K3s логи scheduler в логах control-plane узла
   kubectl logs -n kube-system -l component=kube-scheduler --tail=100
   ```

2. **Проверить детали узла:**
   ```bash
   kubectl describe node canton-node-65-108-15-30 > /tmp/node-description.txt
   cat /tmp/node-description.txt | grep -i "warning\|error\|invalid"
   ```

3. **Попробовать принудительное удаление и пересоздание:**
   ```bash
   kubectl delete deployment maximus redis -n maximus
   # Затем применить конфигурацию заново
   ```

4. **Если проблема с диском на узле:**
   ```bash
   ssh root@65.108.15.30
   df -h
   du -sh /var/lib/rancher/k3s/storage/*
   systemctl restart k3s-agent
   ```

## 📝 ОТЧЕТЫ

Все скрипты сохраняют отчеты в `/tmp/`:
- `fix-maximus-scheduling-complete.sh` → `/tmp/maximus-fix-YYYYMMDD-HHMMSS/`
- Детальные описания подов, узлов, событий

## ✅ ЧЕКЛИСТ ПРОВЕРКИ

После выполнения скриптов проверьте:

- [ ] Все поды maximus и redis в статусе Running
- [ ] Endpoints содержат IP адреса подов
- [ ] Ingress настроены и указывают на правильные сервисы
- [ ] Сертификаты в статусе Ready
- [ ] Сайты доступны через HTTPS
- [ ] HTTP редирект на HTTPS работает
- [ ] Нет Pending подов (кроме временных cert-manager)

## 🔗 СВЯЗАННЫЕ СКРИПТЫ

- `scripts/fix-maximus-scheduling-complete.sh` - основное исправление
- `scripts/verify-all-sites.sh` - проверка доступности
- `scripts/fix-kubernetes-scheduling.sh` - общая диагностика планирования
- `scripts/check-sites-availability.sh` - базовая проверка сайтов
- `scripts/diagnose-cluster.sh` - общая диагностика кластера

## 📞 ПОДДЕРЖКА

Если проблемы не решены:
1. Проверьте отчеты в `/tmp/`
2. Проверьте логи: `kubectl logs -n maximus <pod-name>`
3. Проверьте события: `kubectl get events -n maximus --sort-by='.lastTimestamp'`
