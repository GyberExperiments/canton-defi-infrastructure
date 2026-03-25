# ✅ ИСПРАВЛЕНИЕ: Wallet Endpoints - Использование официальных образов

**Дата:** 2025-11-29  
**Статус:** Исправлено - образы заменены на официальные

---

## 🔍 ПРОБЛЕМА

В манифесте `canton-validator-full-stack.yaml` использовались **устаревшие образы** из репозитория `themacroeconomicdao`:
- ❌ `ghcr.io/themacroeconomicdao/canton-participant:0.5.8` - не существует
- ❌ `ghcr.io/themacroeconomicdao/validator-app:0.5.8` - не существует

## ✅ РЕШЕНИЕ

Заменены образы на **официальные** из репозитория Digital Asset:
- ✅ `ghcr.io/digital-asset/decentralized-canton-sync/docker/canton-participant:0.5.8`
- ✅ `ghcr.io/digital-asset/decentralized-canton-sync/docker/validator-app:0.5.8`

## 📝 ИЗМЕНЕНИЯ

### Файл: `blockchain/k8s/canton-validator-full-stack.yaml`

**Было:**
```yaml
containers:
- name: participant
  image: ghcr.io/themacroeconomicdao/canton-participant:0.5.8

containers:
- name: validator
  image: ghcr.io/themacroeconomicdao/validator-app:0.5.8
```

**Стало:**
```yaml
containers:
- name: participant
  image: ghcr.io/digital-asset/decentralized-canton-sync/docker/canton-participant:0.5.8

containers:
- name: validator
  image: ghcr.io/digital-asset/decentralized-canton-sync/docker/validator-app:0.5.8
```

## 🔗 ОФИЦИАЛЬНЫЙ РЕПОЗИТОРИЙ

**Репозиторий:** `ghcr.io/digital-asset/decentralized-canton-sync/docker/`

**Доступные образы:**
- `canton-participant:0.5.8` (или `0.5.3`)
- `validator-app:0.5.8` (или `0.5.3`)
- `wallet-web-ui:0.5.8`
- `ans-web-ui:0.5.8`

**GitHub:** https://github.com/digital-asset/decentralized-canton-sync

## ✅ ЧТО УЖЕ СДЕЛАНО

1. ✅ Конфигурация `ADDITIONAL_CONFIG_WALLET` добавлена
2. ✅ Секрет `ghcr-creds` обновлен
3. ✅ Образы заменены на официальные
4. ✅ Манифест применен

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. Проверить, что поды запускаются с новыми образами
2. Проверить логи на предмет регистрации wallet endpoints
3. Протестировать endpoints после запуска

---

**Статус:** ✅ Образы исправлены на официальные  
**Следующий шаг:** Проверить запуск подов и работу endpoints





