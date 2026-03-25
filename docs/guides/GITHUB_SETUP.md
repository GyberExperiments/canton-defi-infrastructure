# 🔐 GitHub Actions Setup для Canton OTC

## 🚀 Безопасная установка секретов (РЕКОМЕНДУЕТСЯ)

**Секреты остаются на вашем компьютере и передаются в GitHub только в зашифрованном виде!** 

### 1. Подготовьте .env файл
```bash
# Скопируйте template
cp env.template .env.production

# Отредактируйте своими данными
nano .env.production
```

### 2. Создайте GitHub токен
- Перейдите: https://github.com/settings/tokens
- Создайте токен с правами: `repo`, `admin:org`

### 3. Запустите безопасную установку
```bash
# Установите ВСЕ секреты одной командой
python3 setup-github-secrets-api.py YOUR_GITHUB_TOKEN
```

**🎉 Готово! Все секреты безопасно установлены в GitHub.**

---

## 📋 Что устанавливается автоматически:

- ✅ **KUBECONFIG** (автоматически из ~/.kube/config)  
- ✅ **Google Sheets** секреты (GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)
- ✅ **Telegram Bot** секреты (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- ✅ **SMTP** конфигурация (SMTP_HOST, SMTP_PORT, SMTP_USER, etc.)
- ✅ **OTC** настройки (USDT_RECEIVING_ADDRESS, CANTON_COIN_PRICE_USD)
- ✅ **Security** секреты (ADMIN_API_KEY, NEXTAUTH_SECRET - автогенерация если пусто)

## 🔒 Best Practices безопасности:

1. **Файл .env.production НЕ коммитится** (добавлен в .gitignore)
2. **Секреты читаются только локально** и передаются напрямую в GitHub
3. **Автогенерация** критичных секретов (API ключи)
4. **Base64 кодирование** для kubeconfig автоматически

## 🚀 Запуск деплоя

После настройки secrets:

1. **Автоматический деплой**: При каждом push в main ветку
2. **Ручной деплой**: Перейдите в Actions → Deploy Canton OTC to Kubernetes → Run workflow

## 🔄 Процесс деплоя

1. **Build**: Сборка Docker образа
2. **Push**: Публикация в GitHub Container Registry
3. **Deploy**: Автоматический деплой в Kubernetes
4. **Verify**: Проверка статуса деплоя

## 📊 Мониторинг

После деплоя проверьте:
- **GitHub Actions**: Статус workflow
- **Kubernetes**: `kubectl get pods -n canton-otc`
- **Сайт**: https://1otc.cc/api/health

## 🛠️ Команды для локальной отладки

```bash
# Проверить статус в k8s
kubectl get all -n canton-otc

# Логи приложения
kubectl logs -f deployment/canton-otc -n canton-otc

# Перезапуск при необходимости
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## 🔒 Безопасность

- ✅ Все секреты хранятся в GitHub Secrets
- ✅ Kubeconfig защищен base64 кодированием
- ✅ GHCR использует официальный GITHUB_TOKEN
- ✅ SSL сертификаты через cert-manager
- ✅ Traefik rate limiting активирован

## 🎯 После настройки

1. Сделайте любой commit в main ветку
2. Откройте GitHub Actions для мониторинга
3. Проверьте https://1otc.cc после завершения деплоя

**🚀 Готово к продакшену!**
