# ⚡ Quick Start - Canton OTC CI/CD

## 🚀 Запуск за 3 шага

### 1️⃣ Подготовка
```bash
# Авторизуйтесь в GitHub CLI
gh auth login

# Скопируйте конфиг
cp env.template .env.production
```

### 2️⃣ Настройка
Отредактируйте `.env.production` своими данными:
```bash
# Минимум для работы:
GOOGLE_SHEET_ID=your_sheet_id
TELEGRAM_BOT_TOKEN=your_bot_token
USDT_RECEIVING_ADDRESS=your_wallet_address
# ... остальные параметры
```

### 3️⃣ Деплой
```bash
# Создай GitHub токен: https://github.com/settings/tokens (repo, admin:org)
# Установка всех секретов одной командой
python3 setup-github-secrets-api.py YOUR_GITHUB_TOKEN

# Деплой
git push
```

**🎉 Готово! Через 5-10 минут ваше приложение будет доступно на https://1otc.cc**

---

## 🔍 Проверка статуса

```bash
# GitHub Actions
open https://github.com/TheMacroeconomicDao/CantonOTC/actions

# Kubernetes статус  
kubectl get pods -n canton-otc

# Тест приложения
curl https://1otc.cc/api/health
```

## 🆘 Если что-то не работает

1. **Проверьте секреты**: `gh secret list`
2. **Проверьте логи**: GitHub Actions → Deploy Canton OTC → Logs
3. **Проверьте поды**: `kubectl get pods -n canton-otc -o wide`

**🚀 Всё! Ваш CI/CD pipeline работает.**
