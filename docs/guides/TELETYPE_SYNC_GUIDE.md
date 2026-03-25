# 📚 Teletype Article Sync Guide

Автоматическое копирование статей с Teletype аккаунта @techhy в блог 1OTC.

---

## 🎯 Обзор

API для синхронизации статей с Teletype позволяет:
- Получать список статей с аккаунта @techhy
- Копировать контент статей
- Конвертировать в формат блога
- Автоматически добавлять в блог

---

## 📡 API Endpoints

### GET /api/teletype-sync?action=list

Получить список всех статей с Teletype.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "articles": [
    {
      "id": "canton-network-101",
      "title": "Canton Network 101",
      "excerpt": "...",
      "url": "https://teletype.in/@techhy/canton-network-101",
      "publishedAt": "2025-11-02T00:00:00Z"
    }
  ]
}
```

### GET /api/teletype-sync?action=sync&id=ARTICLE_ID

Синхронизировать конкретную статью.

**Response:**
```json
{
  "success": true,
  "articleId": "canton-network-101",
  "content": "<h2>Article HTML content...</h2>"
}
```

### POST /api/teletype-sync

Синхронизировать статью по URL.

**Request:**
```json
{
  "articleUrl": "https://teletype.in/@techhy/canton-network-101"
}
```

**Response:**
```json
{
  "success": true,
  "articleId": "canton-network-101",
  "content": "<h2>Article HTML content...</h2>",
  "message": "Article synced successfully. Add to blog manually or implement auto-save."
}
```

---

## 🔧 Использование

### Ручная синхронизация через API

```bash
# Получить список статей
curl https://1otc.cc/api/teletype-sync?action=list

# Синхронизировать статью по URL
curl -X POST https://1otc.cc/api/teletype-sync \
  -H "Content-Type: application/json" \
  -d '{"articleUrl": "https://teletype.in/@techhy/canton-network-101"}'
```

### Автоматическая синхронизация

Для автоматической синхронизации можно настроить:

1. **Cron Job** (рекомендуется):
   ```bash
   # Каждый день в 3:00 AM
   0 3 * * * curl -X POST https://1otc.cc/api/teletype-sync?action=sync-all
   ```

2. **GitHub Actions**:
   ```yaml
   name: Sync Teletype Articles
   on:
     schedule:
       - cron: '0 3 * * *' # Daily at 3 AM
   jobs:
     sync:
       runs-on: ubuntu-latest
       steps:
         - name: Sync articles
           run: |
             curl -X POST ${{ secrets.APP_URL }}/api/teletype-sync?action=sync-all
   ```

---

## 📝 Добавление статьи в блог

После синхронизации статьи нужно:

1. **Скопировать контент** из API response
2. **Добавить в `src/app/blog/[slug]/page.tsx`**:
   ```typescript
   'canton-network-101': {
     id: 'canton-network-101',
     title: 'Canton Network 101: Complete Guide',
     excerpt: '...',
     content: '<h2>...</h2>', // HTML из API
     date: '2025-11-02',
     author: 'TechHy',
     category: 'Education',
     readTime: '15 min read',
     image: '/og-image.png',
     source: 'https://teletype.in/@techhy/canton-network-101'
   }
   ```

3. **Добавить в список** `src/app/blog/page.tsx`

---

## ⚙️ Настройка

### Переменные окружения

```bash
# Опционально: если Teletype требует API ключ
TELETYPE_API_KEY=your_api_key
```

### Кастомизация

- **Конвертация контента**: Функция `convertTeletypeToHTML()` в `route.ts`
- **Автосохранение**: Можно добавить сохранение в базу данных или файл
- **Уведомления**: Добавить отправку уведомлений при новой статье

---

## 🚀 Будущие улучшения

- [ ] Автоматическое сохранение в базу данных
- [ ] Webhook для мгновенной синхронизации
- [ ] Поддержка изображений
- [ ] Автоматическое создание slug из заголовка
- [ ] Поддержка мета-тегов из Teletype

---

**Автор**: AI Assistant  
**Дата**: 2 ноября 2025

