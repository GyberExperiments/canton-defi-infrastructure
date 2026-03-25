# ⚡ Быстрый старт: Исправление сохранения цен

## 🎯 Проблема
Цена меняется на `0.1` → Сохраняется → Через 30 сек возвращается обратно ❌

## ✅ Решение
Переключились с GitHub Secrets на ConfigMap для настроек.

## 📦 Что сделано

### 1. Новые файлы
- ✅ `/src/lib/kubernetes-config.ts` - Kubernetes ConfigMap API клиент
- ✅ `/config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml` - RBAC для ConfigMap
- ✅ `/scripts/setup/apply-configmap-rbac.sh` - Скрипт установки

### 2. Обновлённые файлы
- ✅ `/src/app/api/admin/settings/route.ts` - Обновление через ConfigMap
- ✅ `/src/app/admin/settings/SettingsPageContent.tsx` - Мгновенное обновление UI
- ✅ `/config/kubernetes/k8s/minimal-stage/deployment.yaml` - ServiceAccount
- ✅ `/config/kubernetes/k8s/minimal-stage/configmap.yaml` - Новые переменные
- ✅ `/package.json` - Добавлена зависимость @kubernetes/client-node

## 🚀 Установка

### 1. Установить зависимости
```bash
pnpm install
```

### 2. Применить изменения в Kubernetes
```bash
# Автоматически (рекомендуется)
./scripts/setup/apply-configmap-rbac.sh

# ИЛИ вручную:
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap-rbac.yaml
kubectl apply -f config/kubernetes/k8s/minimal-stage/configmap.yaml
kubectl apply -f config/kubernetes/k8s/minimal-stage/deployment.yaml
```

### 3. Проверить статус
```bash
# Проверить pod
kubectl get pods -n canton-otc-minimal-stage

# Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep ConfigMap
```

## 🧪 Тестирование

### Через UI:
1. Открыть: https://stage.minimal.build.infra.1otc.cc/admin/settings
2. Изменить цену на `0.1`
3. Нажать "Сохранить"
4. ✅ Проверить что цена осталась `0.1` (не вернулась!)

### Через API:
```bash
# Получить настройки
curl https://stage.minimal.build.infra.1otc.cc/api/admin/settings

# Обновить цену
curl -X PATCH https://stage.minimal.build.infra.1otc.cc/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"cantonCoinBuyPrice": 0.21}'
```

### Проверка ConfigMap:
```bash
# Посмотреть ConfigMap
kubectl get configmap canton-otc-config -n canton-otc-minimal-stage -o yaml

# Посмотреть конкретное значение
kubectl get configmap canton-otc-config -n canton-otc-minimal-stage \
  -o jsonpath='{.data.CANTON_COIN_BUY_PRICE_USD}'
```

## 🔍 Диагностика

### Проблема: "ConfigMap недоступен"
```bash
# Проверить права
kubectl auth can-i patch configmaps \
  --as=system:serviceaccount:canton-otc-minimal-stage:canton-otc-configmap-manager \
  -n canton-otc-minimal-stage

# Должно вывести: yes
```

### Проблема: "Изменения не применяются"
```bash
# Проверить логи
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage

# Должны видеть:
# ✅ ConfigMap успешно обновлён
# ✅ ConfigManager обновлён
```

## 📊 Как это работает

### Старая архитектура (GitHub Secrets):
```
UI → API → GitHub Secrets → CI/CD → Redeploy (5-10 мин) → Обновление
```

### Новая архитектура (ConfigMap):
```
UI → API → ConfigMap → process.env → ConfigManager → UI (мгновенно!)
```

## 🎉 Результат

| До | После |
|---|---|
| ❌ Цена сбрасывается через 30 сек | ✅ Цена сохраняется мгновенно |
| ❌ Требуется редеплой (5-10 мин) | ✅ Применяется мгновенно |
| ❌ GitHub Secrets для настроек | ✅ ConfigMap для настроек |
| ❌ UI показывает старые значения | ✅ UI обновляется сразу |

## 📚 Дополнительно

Полная документация: [CONFIGMAP_INTEGRATION_FIX_REPORT.md](./CONFIGMAP_INTEGRATION_FIX_REPORT.md)

---
**Дата:** 23 октября 2025  
**Статус:** ✅ Готово к использованию

