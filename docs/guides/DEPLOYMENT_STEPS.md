# 🚀 Шаги для применения исправления

## ✅ Что уже сделано:
1. ✅ Код запушен в репозиторий
2. ✅ Зависимости установлены локально
3. ✅ Должен запуститься автоматический деплой

## 📋 Что нужно сделать:

### 1. Дождаться окончания деплоя
```bash
# Проверить статус workflow в GitHub
# https://github.com/TheMacroeconomicDao/CantonOTC/actions

# ИЛИ проверить статус pod в Kubernetes
kubectl get pods -n canton-otc-minimal-stage -w
```

### 2. Применить RBAC для ConfigMap
```bash
# Автоматически
./scripts/setup/apply-configmap-rbac.sh

# ИЛИ вручную
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml
kubectl apply -f config/kubernetes/k8s/minimal-stage/deployment.yaml
```

### 3. Проверить что всё работает
```bash
# Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep ConfigMap

# Должны увидеть:
# ✅ Kubernetes API клиент инициализирован
# ИЛИ (если не в кластере):
# ⚠️ Используется fallback режим
```

### 4. Протестировать через UI
1. Открыть: https://stage.minimal.build.infra.1otc.cc/admin/settings
2. Изменить цену на `0.1`
3. Нажать "Сохранить"
4. Подождать 30+ секунд
5. ✅ Проверить что цена осталась `0.1`

## 🔍 Важно:

### Если деплой ещё не завершён:
- Старый код всё ещё работает
- Логи будут показывать старые сообщения про GitHub Secrets
- Цены будут сбрасываться

### После успешного деплоя:
- Новый код заработает
- Логи покажут "ConfigMap успешно обновлён"
- Цены будут сохраняться мгновенно

### Fallback режим:
Если в логах видите "Используется fallback режим":
- Это нормально для локальной разработки
- В production/staging RBAC должен быть применён
- Изменения всё равно будут работать, но только в памяти

## ⏰ Время ожидания:
- Деплой через GitHub Actions: ~5-10 минут
- Применение RBAC: ~30 секунд
- Перезапуск pod: ~1-2 минуты

## 🎯 Проверка успеха:

### В логах должно быть:
```
✅ Kubernetes API клиент инициализирован
🔄 Обновление ConfigMap
✅ ConfigMap успешно обновлён
✅ ConfigManager обновлён
```

### НЕ должно быть:
```
❌ Settings have been updated in GitHub secrets  
❌ CI/CD pipeline has been triggered
❌ Deployment will complete in 5-10 minutes
```

