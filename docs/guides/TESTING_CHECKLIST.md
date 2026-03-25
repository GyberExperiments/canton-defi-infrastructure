# ✅ Чеклист тестирования: Исправление CSS Loading

**Цель:** Проверить, что CSS файлы больше не загружаются через `<script>` теги и Input поля работают корректно.

---

## 🔧 Шаг 1: Rebuild приложения

```bash
# Перейти в директорию проекта
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Очистить кеш
rm -rf .next
rm -rf node_modules/.cache

# Переустановить зависимости (опционально, если были изменения)
pnpm install

# Production build
pnpm build

# Запустить в production режиме
pnpm start
```

**Ожидаемый результат:**
- ✅ Build завершается успешно без ошибок
- ✅ Нет warning о CSS или webpack конфигурации
- ✅ Сервер запускается на `http://localhost:3000`

---

## 🌐 Шаг 2: Открыть страницу логина

1. Открыть браузер (Chrome или Firefox recommended)
2. Перейти на `http://localhost:3000/admin/login`
3. Открыть DevTools (F12)

---

## 🔍 Шаг 3: Проверка HTML (Elements tab)

### Проверить `<head>`:

```html
<!-- ✅ ДОЛЖНО БЫТЬ ТАК: -->
<head>
  <link rel="stylesheet" href="/_next/static/css/7e7d96b1e6991756.css" data-precedence="next"/>
  <!-- Другие link теги для CSS могут быть -->
</head>

<!-- ❌ НЕ ДОЛЖНО БЫТЬ ТАКИХ ТЕГОВ: -->
<script src="/_next/static/css/XXXXX.css" async=""></script>
```

**Как проверить:**
1. В DevTools → Elements tab
2. Развернуть `<head>` элемент
3. Найти все теги, содержащие `.css` в `href` или `src`
4. Убедиться, что все CSS загружаются только через `<link rel="stylesheet">`

**Критерии:**
- ✅ Все CSS файлы загружаются через `<link>` теги
- ✅ Нет `<script>` тегов с `src` указывающим на `.css` файлы

---

## 📊 Шаг 4: Проверка Console (Console tab)

### Проверить отсутствие ошибок:

**Ожидаемый результат:** Console должен быть чистым или содержать только информационные сообщения.

**НЕ должно быть:**
```
❌ Refused to execute script from 'https://1otc.cc/_next/static/css/XXX.css' 
   because its MIME type ('text/css') is not executable
```

**Допустимо:**
```
ℹ️ [INFO] React hydrated successfully
ℹ️ [INFO] Next.js initialized
```

**Критерии:**
- ✅ Нет ошибок с "Refused to execute script"
- ✅ Нет MIME type errors
- ✅ JavaScript загружается и выполняется

---

## 🌐 Шаг 5: Проверка Network (Network tab)

### Проверить загрузку CSS файлов:

1. В DevTools → Network tab
2. Поставить фильтр "CSS" или "All"
3. Обновить страницу (Ctrl+R / Cmd+R)
4. Найти все `.css` файлы

**Проверить для КАЖДОГО CSS файла:**

| Параметр | Ожидаемое значение |
|----------|-------------------|
| Name | `*.css` |
| Type | `stylesheet` (не `script`!) |
| Status | `200` |
| Content-Type | `text/css; charset=utf-8` |
| Size | > 0 bytes |

**Критерии:**
- ✅ Все CSS файлы загружаются с `Type: stylesheet`
- ✅ Headers содержат правильный `Content-Type`
- ❌ Нет CSS файлов с `Type: script`

---

## ⌨️ Шаг 6: Функциональное тестирование Input полей

На странице `/admin/login`:

### Тест 1: Email поле

1. **Кликнуть** на поле "Email"
   - ✅ Поле должно получить фокус (border изменится)
   - ✅ Label должен анимированно подняться вверх
   - ✅ Должна появиться голубая линия снизу

2. **Ввести** текст: `admin@canton-otc.com`
   - ✅ Текст должен отображаться в поле
   - ✅ Каждый символ должен появляться при вводе
   - ✅ Курсор должен двигаться

3. **Кликнуть** вне поля (убрать фокус)
   - ✅ Label должен остаться вверху (т.к. есть текст)
   - ✅ Голубая линия должна исчезнуть
   - ✅ Текст должен остаться в поле

### Тест 2: Password поле

1. **Кликнуть** на поле "Пароль"
   - ✅ Поле должно получить фокус
   - ✅ Label должен анимированно подняться вверх

2. **Ввести** текст: `Wm8vJISLZ9oeCaca2025!`
   - ✅ Символы должны отображаться как `••••••••`
   - ✅ Каждый символ должен появляться при вводе

3. **Проверить** видимость пароля (если есть кнопка показа/скрытия)
   - ✅ Должна работать toggle видимости

### Тест 3: Отправка формы

1. **Заполнить** оба поля:
   - Email: `admin@canton-otc.com`
   - Password: `Wm8vJISLZ9oeCaca2025!`

2. **Нажать** кнопку "Войти"
   - ✅ Кнопка должна измениться на "Вход..."
   - ✅ Должна произойти попытка авторизации
   - ✅ При успехе → редирект на `/admin`
   - ✅ При ошибке → сообщение об ошибке

**Критерии:**
- ✅ Все Input поля полностью интерактивны
- ✅ Текст вводится и отображается корректно
- ✅ Анимации работают плавно
- ✅ Форма отправляется успешно

---

## 🎨 Шаг 7: Визуальная проверка стилей

### Проверить, что все стили применены:

1. **Background** страницы:
   - ✅ Должен быть gradient background (темный с эффектами)
   - ✅ Mesh gradient aurora эффект должен быть виден

2. **Login форма**:
   - ✅ Белая карточка по центру экрана
   - ✅ Shadow вокруг карточки
   - ✅ Rounded corners (border-radius)

3. **Input поля**:
   - ✅ Glassmorphism эффект
   - ✅ Animated labels
   - ✅ Focus indicators (голубая линия)
   - ✅ Particle effects при фокусе

4. **Typography**:
   - ✅ Шрифт Inter применен
   - ✅ Правильные размеры текста
   - ✅ Правильные цвета

**Критерии:**
- ✅ Все стили из `globals.css` применены
- ✅ Tailwind классы работают
- ✅ Custom CSS переменные работают
- ✅ Нет Flash of Unstyled Content (FOUC)

---

## 🚀 Шаг 8: Production deployment тестирование

### Docker build:

```bash
# Build Docker image
docker build -t canton-otc:css-fix-test .

# Run container
docker run -p 3000:3000 -e NODE_ENV=production canton-otc:css-fix-test
```

**Проверить:**
- ✅ Docker build успешен
- ✅ Container запускается без ошибок
- ✅ Приложение доступно на `http://localhost:3000`
- ✅ Все предыдущие тесты проходят в Docker окружении

### Kubernetes deployment:

```bash
# Apply updated config
kubectl apply -f k8s/

# Restart deployment
kubectl rollout restart deployment/canton-otc-minimal-stage

# Проверить статус
kubectl get pods -l app=canton-otc

# Проверить логи
kubectl logs -l app=canton-otc --tail=50
```

**Проверить:**
- ✅ Pod успешно перезапустился
- ✅ Логи не содержат ошибок
- ✅ Приложение доступно через Ingress
- ✅ Все тесты проходят на production URL

---

## 📱 Шаг 9: Cross-browser тестирование

### Протестировать в разных браузерах:

| Браузер | Версия | Email Input | Password Input | Styles | Console |
|---------|--------|-------------|----------------|--------|---------|
| Chrome | Latest | ⬜ | ⬜ | ⬜ | ⬜ |
| Firefox | Latest | ⬜ | ⬜ | ⬜ | ⬜ |
| Safari | Latest | ⬜ | ⬜ | ⬜ | ⬜ |
| Edge | Latest | ⬜ | ⬜ | ⬜ | ⬜ |

**Критерии для каждого браузера:**
- ✅ Input поля работают
- ✅ Стили применены корректно
- ✅ Console без MIME type ошибок
- ✅ Нет `<script>` тегов для CSS

---

## 📱 Шаг 10: Mobile тестирование

### Протестировать на мобильных устройствах:

**DevTools Mobile Emulation:**
1. DevTools → Toggle device toolbar (Ctrl+Shift+M)
2. Выбрать устройство: iPhone 12 Pro, Pixel 5, iPad
3. Повторить все функциональные тесты

**Real Mobile Devices (если возможно):**
- iOS Safari
- Android Chrome

**Критерии:**
- ✅ Touch events работают
- ✅ Virtual keyboard открывается
- ✅ Input focus работает на touch
- ✅ Стили адаптивны (responsive)

---

## 📊 Итоговый чеклист

### Критические проверки (ОБЯЗАТЕЛЬНО):

- [ ] ✅ Нет `<script>` тегов с `.css` файлами в HTML
- [ ] ✅ Нет MIME type ошибок в Console
- [ ] ✅ Email Input работает (ввод текста)
- [ ] ✅ Password Input работает (ввод пароля)
- [ ] ✅ Форма логина отправляется

### Дополнительные проверки (РЕКОМЕНДУЕТСЯ):

- [ ] ✅ CSS загружается через `<link>` теги с правильным Content-Type
- [ ] ✅ Все стили применены корректно
- [ ] ✅ Анимации работают плавно
- [ ] ✅ Docker build успешен
- [ ] ✅ Kubernetes deployment работает
- [ ] ✅ Cross-browser compatibility
- [ ] ✅ Mobile responsive работает

---

## 🐛 Troubleshooting

### Если проблема НЕ решена:

#### Проблема: Всё ещё есть `<script>` теги для CSS

**Причины:**
1. `.next` кеш не был очищен
2. Browser cache не очищен
3. Изменения в `next.config.js` не применились

**Решение:**
```bash
# Полная очистка
rm -rf .next
rm -rf node_modules/.cache
rm -rf out

# Пересборка
pnpm build

# Очистить browser cache (DevTools)
# Network tab → ⚙️ → Clear browser cache
```

#### Проблема: Input всё ещё не работает

**Причины:**
1. JavaScript errors блокируют выполнение
2. Другие конфликтующие скрипты
3. CSP headers блокируют inline scripts

**Диагностика:**
```javascript
// В Console tab выполнить:
console.log('React:', typeof React);
console.log('Motion:', typeof motion);
console.log('Input component:', document.querySelector('input[type="email"]'));
```

**Проверить:**
- Console → есть ли другие JavaScript ошибки?
- Network → все ли JS файлы загрузились успешно?
- Elements → есть ли Input элемент в DOM?

#### Проблема: Стили не применяются

**Причины:**
1. CSS файл не загрузился (404)
2. CSS заблокирован CSP headers
3. Cache проблемы

**Диагностика:**
- Network tab → проверить статус CSS файлов (должен быть 200)
- Console tab → проверить CSP violations
- Elements tab → Computed styles для Input элемента

---

## ✅ Финальное подтверждение

### После прохождения всех тестов:

**Подтверждение исправления:**
- ✅ CSS загружается ТОЛЬКО через `<link rel="stylesheet">` теги
- ✅ НЕТ `<script src="...css">` тегов в HTML
- ✅ НЕТ MIME type ошибок в Console
- ✅ Input поля полностью функциональны
- ✅ Пользователь может войти в админ панель

---

**Статус:** ⬜ НЕ ПРОТЕСТИРОВАНО / 🟡 В ПРОЦЕССЕ / ✅ ПРОТЕСТИРОВАНО УСПЕШНО / ❌ ЕСТЬ ПРОБЛЕМЫ

**Дата тестирования:** ___________________

**Тестировщик:** ___________________

**Комментарии:**
```
_____________________________________________
_____________________________________________
_____________________________________________
```

