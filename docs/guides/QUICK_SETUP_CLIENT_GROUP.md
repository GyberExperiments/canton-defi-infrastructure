# ⚡ Быстрая настройка группы клиентов

## 🎯 Что нужно сделать

### 1. Получить ID группы и добавить в секреты

**Способ 1: Автоматически (если уже написали "ruheggs")**
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
export TELEGRAM_BOT_TOKEN="your_bot_token"
bash scripts/setup-client-group-secret.sh
```

**Способ 2: Вручную**
1. Получите ID группы (бот @userinfobot или из логов)
2. Добавьте в GitHub Secrets:
   ```bash
   gh secret set TELEGRAM_CLIENT_GROUP_CHAT_ID -b "-1001234567890"
   ```
3. External Secret автоматически синхронизирует в Kubernetes

### 2. Применить изменения

```bash
# Применить обновленный external-secret
kubectl apply -f config/kubernetes/k8s/minimal-stage/external-secret.yaml

# Перезапустить deployment
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=180s
```

### 3. Проверить работу

```bash
# Создать тестовую заявку
bash scripts/test-deal-readiness.sh

# Проверить логи
kubectl logs -n canton-otc deployment/canton-otc --tail=50 | grep "client group"
```

---

## ✅ Что изменилось

- ✅ Заявки с сайта теперь идут в **группу клиентов** (не в группу нотификаций)
- ✅ Сообщения операторов клиентам остаются в **личном чате**
- ✅ Группа нотификаций используется только для уведомлений операторов

---

## 📋 Файлы изменены

- ✅ `src/lib/services/telegram.ts` - заявки идут в группу клиентов
- ✅ `config/kubernetes/k8s/minimal-stage/deployment.yaml` - добавлена переменная
- ✅ `config/kubernetes/k8s/minimal-stage/external-secret.yaml` - добавлен секрет

---

**Готово!** После добавления секрета и перезапуска deployment заявки будут приходить в группу клиентов.
