# 🔐 Руководство по безопасности скриптов

## ⚠️ КРИТИЧЕСКИ ВАЖНО

**НИКОГДА** не коммитьте в Git:
- ❌ Пароли в plain text
- ❌ API ключи
- ❌ Токены доступа
- ❌ Private keys
- ❌ Секреты любого вида

## 🛡️ Безопасное использование скриптов

### `update-admin-password.sh`

**✅ ПРАВИЛЬНО:**
```bash
# Способ 1: Передать пароль как аргумент
./scripts/update-admin-password.sh "YourSecurePassword123!"

# Способ 2: Через переменную окружения
export ADMIN_PASSWORD="YourSecurePassword123!"
./scripts/update-admin-password.sh

# Способ 3: Безопасный ввод (не сохраняется в history)
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
./scripts/update-admin-password.sh
```

**❌ НЕПРАВИЛЬНО:**
```bash
# НЕ редактируйте скрипт и не добавляйте пароль внутрь!
PASSWORD="MyPassword123"  # ❌ НИКОГДА ТАК НЕ ДЕЛАЙТЕ
```

## 📋 Проверка безопасности перед коммитом

Перед каждым `git commit` выполните:

```bash
# Проверка на случайные секреты
./scripts/security-audit.sh

# Или вручную проверьте:
git diff | grep -i "password\|secret\|token\|key" || echo "✅ Чисто"
```

## 🔍 Что делать если случайно закоммитили секрет?

### Немедленные действия:

1. **ИЗМЕНИТЕ секрет** (пароль/токен/ключ)
2. Обновите везде где используется
3. Очистите Git history:

```bash
# Удаление файла из истории Git
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch path/to/file" \
  --prune-empty --tag-name-filter cat -- --all

# Принудительный push (ОПАСНО!)
git push origin --force --all
```

4. **Альтернатива:** Используйте [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

## 🔐 Где безопасно хранить секреты?

### ✅ Безопасные места:

1. **GitHub Secrets** (для CI/CD)
   - Settings → Secrets and variables → Actions
   - Encrypted at rest
   - Не видны в логах

2. **Переменные окружения**
   ```bash
   # ~/.bashrc или ~/.zshrc
   export ADMIN_PASSWORD="password"
   ```

3. **Password managers**
   - 1Password
   - LastPass
   - Bitwarden

4. **Kubernetes Secrets** (для production)
   - Encrypted в etcd
   - RBAC контроль доступа

### ❌ НЕБЕЗОПАСНЫЕ места:

- ❌ Файлы в Git репозитории
- ❌ Скриншоты
- ❌ Email/Slack сообщения
- ❌ Незашифрованные файлы
- ❌ Shell history

## 🎯 Best Practices

### 1. Используйте `.env` для локальной разработки

```bash
# .env (добавлен в .gitignore!)
ADMIN_PASSWORD=your_local_password
```

```javascript
// Загрузка в Node.js
require('dotenv').config();
const password = process.env.ADMIN_PASSWORD;
```

### 2. Ротация секретов

Меняйте пароли регулярно:
- Production пароли: **каждые 90 дней**
- API ключи: **каждые 180 дней**
- JWT секреты: **каждый год**

### 3. Принцип наименьших привилегий

Давайте доступ только к необходимым секретам:
- Frontend dev → только публичные API ключи
- Backend dev → только dev database credentials
- DevOps → production secrets (с 2FA)

## 📚 Дополнительные ресурсы

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Git-secrets tool](https://github.com/awslabs/git-secrets)

## 🚨 Emergency Contacts

Если обнаружили утечку секретов:
1. Немедленно свяжитесь с DevOps team
2. Измените скомпрометированные секреты
3. Проверьте логи на несанкционированный доступ
4. Задокументируйте инцидент

---

**Помните:** Безопасность - это не одноразовая задача, а постоянный процесс! 🔒

