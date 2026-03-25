# 🔗 ССЫЛКИ ДЛЯ РУЧНОЙ ПРОВЕРКИ OIDC AUTH

**Дата:** 2025-11-29  
**Сервер:** 65.108.15.30

---

## ✅ ОСНОВНЫЕ UI

1. **Wallet UI:**
   - http://65.108.15.30/wallet/
   - Ожидается: Загрузка Wallet приложения, форма логина при необходимости

2. **ANS UI:**
   - http://65.108.15.30/ans/
   - Ожидается: Загрузка ANS приложения, форма логина при необходимости

---

## 🔐 OIDC ENDPOINTS

3. **OIDC Discovery:**
   - http://65.108.15.30/.well-known/openid-configuration
   - Ожидается: JSON с конфигурацией OIDC (issuer, endpoints, scopes)

4. **Authorization Endpoint (форма логина):**
   - http://65.108.15.30/auth/v1/authorize?client_id=canton-validator&redirect_uri=http://65.108.15.30/wallet/&response_type=code&scope=openid
   - ✅ **РАБОТАЕТ:** HTML форма логина с полями email и password
   - **Статус:** Исправлено 2025-11-29 - oidc-provider pod был в CrashLoopBackOff, исправлен манифест

5. **JWKS Endpoint:**
   - http://65.108.15.30/jwks
   - Ожидается: JSON с публичными ключами для проверки JWT

---

## 🧪 ТЕСТОВЫЕ ENDPOINTS

6. **Health Check:**
   - http://65.108.15.30/health
   - Ожидается: "healthy"

7. **Config.js:**
   - http://65.108.15.30/config.js
   - Ожидается: JavaScript конфигурация с authority, client_id и т.д.

---

## 📝 ЧТО ПРОВЕРИТЬ

### В Wallet/ANS UI:
- [ ] Страница загружается без ошибок
- [ ] Нет ошибки "Not Found" или "Something went wrong"
- [ ] Консоль браузера (F12) не показывает критичных ошибок
- [ ] При необходимости авторизации показывается форма логина
- [ ] После логина приложение работает

### В Authorization Endpoint:
- [ ] Форма логина отображается корректно
- [ ] Поля email и password видны
- [ ] Кнопка "Login" работает
- [ ] После ввода данных происходит редирект

### В OIDC Discovery:
- [ ] Все endpoints используют порт 80 (не 32232/32233)
- [ ] authorization_endpoint: `http://65.108.15.30/auth/v1/authorize`
- [ ] token_endpoint: `http://65.108.15.30/auth/v1/token`
- [ ] userinfo_endpoint: `http://65.108.15.30/auth/v1/user`

---

## 🐛 ИЗВЕСТНЫЕ ПРОБЛЕМЫ

1. ~~**Переменные в форме логина не подставляются:**~~ ✅ **ИСПРАВЛЕНО**
   - ~~В HTML видно `value= + quote(str(client_id)) +` вместо реальных значений~~
   - Форма теперь корректно отображает все параметры

## ✅ ИСПРАВЛЕННЫЕ ПРОБЛЕМЫ

1. **OIDC Authorization endpoint не работал (502 Bad Gateway):**
   - **Причина:** oidc-provider pod был в состоянии CrashLoopBackOff из-за синтаксической ошибки в Python коде
   - **Решение:** Исправлен манифест `k8s/supabase/oidc-provider-service.yaml` - теперь используется Python файл из ConfigMap вместо встроенного кода
   - **Дата исправления:** 2025-11-29
   - **Статус:** ✅ Работает корректно

---

## 📊 КОНСОЛЬ БРАУЗЕРА

При проверке Wallet/ANS UI откройте консоль разработчика (F12) и проверьте:
- Сетевые запросы к `/auth/v1/authorize`
- Сетевые запросы к `/auth/v1/token`
- Ошибки JavaScript
- Ошибки загрузки ресурсов

---

**После проверки сообщите результаты, и я продолжу исправление!**
