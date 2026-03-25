# 🔧 Google Sheets Service Fix Guide

## 🚨 Проблема

Google Sheets сервис в Canton OTC Exchange не работает из-за ошибки OpenSSL:

```
❌ Failed to get orders from Google Sheets: Error: error:1E08010C:DECODER routines::unsupported
```

## 🔍 Анализ

**Причина:** Приватный ключ Google Service Account повреждается при передаче через Kubernetes секреты. OpenSSL не может декодировать ключ из-за неправильного форматирования переносов строк.

**Статус компонентов:**
- ✅ GitHub секреты: все переменные присутствуют
- ✅ Env файлы: переменные корректно настроены  
- ✅ CI/CD пайплайн: правильно передает секреты
- ❌ Google Sheets сервис: ошибка декодирования ключа

## 🛠️ Решение

### 1. Исправления в коде (уже применены)

**Файл:** `src/lib/services/googleSheets.ts`

**Изменения:**
- ✅ Улучшенная обработка переносов строк в приватном ключе
- ✅ Дополнительная валидация формата ключа
- ✅ Подробное логирование для диагностики
- ✅ Улучшенная обработка ошибок аутентификации

### 2. Тестирование

**Запустите тест подключения:**
```bash
node test-google-sheets.js
```

Этот скрипт проверит:
- Наличие всех переменных окружения
- Формат приватного ключа
- Подключение к Google Sheets API
- Чтение данных из таблицы

### 3. Деплой исправлений

**Для minimal-stage:**
```bash
git add .
git commit -m "fix: исправил обработку приватного ключа Google Sheets для Kubernetes"
git push origin minimal-stage
```

**Для production:**
```bash
git checkout main
git merge minimal-stage
git push origin main
```

### 4. Мониторинг

**Проверьте логи после деплоя:**
```bash
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage
```

**Ожидаемые логи:**
```
🔐 Authenticating with Google Sheets...
Service Account Email: canton-otc@gyber-inter-speak.iam.gserviceaccount.com
Private Key Format Valid: true
✅ Google Sheets authentication successful
```

## 🔄 Альтернативное решение (если проблема сохраняется)

Если исправления не помогут, возможно потребуется:

### 1. Пересоздать Service Account ключ

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите проект `gyber-inter-speak`
3. Перейдите в IAM & Admin → Service Accounts
4. Найдите `canton-otc@gyber-inter-speak.iam.gserviceaccount.com`
5. Создайте новый JSON ключ
6. Обновите GitHub секрет `GOOGLE_PRIVATE_KEY`

### 2. Проверить права доступа

Убедитесь, что Service Account имеет доступ к таблице:
1. Откройте Google Sheets таблицу
2. Нажмите "Поделиться"
3. Добавьте email: `canton-otc@gyber-inter-speak.iam.gserviceaccount.com`
4. Права: "Редактор"

### 3. Проверить API

Убедитесь, что Google Sheets API включен:
1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите проект `gyber-inter-speak`
3. Перейдите в APIs & Services → Library
4. Найдите "Google Sheets API"
5. Убедитесь, что API включен

## 📊 Ожидаемый результат

После применения исправлений:

- ✅ Google Sheets сервис будет работать корректно
- ✅ Заказы будут сохраняться в таблицу
- ✅ Админ панель будет показывать статистику
- ✅ Логи не будут содержать ошибки OpenSSL

## 🚨 Критические моменты

1. **НЕ УДАЛЯЙТЕ** существующие GitHub секреты без создания новых
2. **СОЗДАЙТЕ БЭКАП** перед изменением Service Account ключа
3. **ПРОВЕРЬТЕ ПРАВА** доступа к таблице после изменений
4. **МОНИТОРЬТЕ ЛОГИ** после каждого деплоя

## 📞 Поддержка

Если проблема не решается:
1. Запустите `node test-google-sheets.js` и пришлите вывод
2. Проверьте логи приложения: `kubectl logs deployment/canton-otc -n canton-otc-minimal-stage`
3. Убедитесь, что все переменные окружения корректны
