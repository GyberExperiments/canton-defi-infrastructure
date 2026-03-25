# ✅ Исправление Locale Warning

## Проблема
```
bash: warning: setlocale: LC_ALL: cannot change locale (ru_RU.UTF-8)
```

## Причина
Система пытается использовать `ru_RU.UTF-8`, но этот locale не установлен (только закомментирован в `/etc/locale.gen`).

## Решение

### 1. Установлен C.UTF-8 как дефолтный locale

**Файлы обновлены:**
- `/etc/environment` - глобальные переменные окружения
- `/etc/default/locale` - дефолтный locale системы
- `/root/.bashrc` - для root пользователя
- `/etc/profile.d/locale.sh` - для всех пользователей

**Содержимое:**
```bash
LC_ALL=C.UTF-8
LANG=C.UTF-8
```

### 2. Systemd service обновлен

В `/etc/systemd/system/canton-validator.service` добавлено:
```ini
[Service]
Environment=LC_ALL=C.UTF-8
Environment=LANG=C.UTF-8
```

### 3. Проверка

**Команда без warning:**
```bash
LC_ALL=C.UTF-8 LANG=C.UTF-8 bash -c 'echo Тест'
# Вывод: Тест (без warning)
```

## Применение изменений

**Для текущей SSH сессии:**
```bash
source /etc/environment
source /etc/profile.d/locale.sh
```

**Для новых SSH сессий:**
Изменения применятся автоматически при следующем подключении.

**Для systemd сервисов:**
Изменения применятся автоматически (уже добавлены в service файл).

## Использование в командах

Если warning все еще появляется, используйте:
```bash
LC_ALL=C.UTF-8 LANG=C.UTF-8 <команда>
```

**Дата:** 28 ноября 2025  
**Статус:** ✅ Исправлено





