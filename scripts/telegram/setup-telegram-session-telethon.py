#!/usr/bin/env python3
"""
🔐 Скрипт для получения Telegram сессии администратора через Telethon
Используется для настройки Telegram Client API

Преимущества:
- Более стабильная библиотека
- Лучшая обработка ошибок
- Сессия совместима с GramJS (StringSession)

Требования:
    pip install telethon python-dotenv
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Загружаем переменные окружения
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

try:
    from telethon import TelegramClient
    from telethon.sessions import StringSession
except ImportError:
    print("❌ Telethon не установлен!")
    print("")
    print("📝 Установите Telethon:")
    print("   pip install telethon python-dotenv")
    print("")
    print("Или через pip3:")
    print("   pip3 install telethon python-dotenv")
    sys.exit(1)

api_id = os.getenv('TELEGRAM_API_ID')
api_hash = os.getenv('TELEGRAM_API_HASH')

if not api_id or not api_hash:
    print("❌ TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env.local")
    print("")
    print("📝 Инструкция:")
    print("1. Перейдите на https://my.telegram.org/apps")
    print("2. Войдите с номером телефона администратора")
    print("3. Создайте новое приложение (Platform: Other)")
    print("4. Скопируйте api_id и api_hash")
    print("5. Добавьте в .env.local:")
    print("   TELEGRAM_API_ID=12345678")
    print("   TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890")
    sys.exit(1)

try:
    api_id = int(api_id)
except ValueError:
    print("❌ TELEGRAM_API_ID должен быть числом")
    sys.exit(1)

print("🚀 Запуск Telegram Client для получения сессии...")
print("📱 Используйте номер телефона администратора")
print("")
print("📋 Конфигурация:")
print(f"   API ID: {api_id}")
print(f"   API Hash: {api_hash[:10]}...")
print("")

# Создаем клиент с пустой сессией
session = StringSession()
client = TelegramClient(session, api_id, api_hash)

try:
    print("🔌 Подключение к Telegram...")
    client.start()
    
    print("✅ Клиент успешно подключен!")
    
    # Получаем информацию о пользователе
    me = client.get_me()
    print(f"👤 Авторизован как: {me.first_name or ''} {me.last_name or ''} (@{me.username or 'без username'})")
    print(f"   ID: {me.id}")
    
    # Получаем строку сессии
    session_string = client.session.save()
    
    if not session_string or len(session_string) < 10:
        raise Exception("Сессия слишком короткая или пустая")
    
    # Сохраняем в файл
    script_dir = Path(__file__).parent
    session_path = script_dir.parent / '.telegram-session'
    session_path.write_text(session_string, encoding='utf-8')
    print(f"✅ Файл сессии сохранен: {session_path}")
    
    # Также сохраняем в .env.local
    env_path = script_dir.parent / '.env.local'
    env_content = ""
    if env_path.exists():
        env_content = env_path.read_text(encoding='utf-8')
        # Удаляем старую сессию если есть
        lines = env_content.split('\n')
        env_content = '\n'.join([line for line in lines if not line.startswith('TELEGRAM_SESSION_STRING=')])
    
    env_content += f"\nTELEGRAM_SESSION_STRING={session_string}\n"
    env_path.write_text(env_content, encoding='utf-8')
    print("✅ Сессия добавлена в .env.local")
    
    print("")
    print("✅ Сессия успешно получена и сохранена!")
    print("")
    print("📊 Информация о сессии:")
    print(f"   Длина: {len(session_string)} символов")
    print(f"   Начинается с: {session_string[:20]}...")
    print("")
    print("⚠️ ВАЖНО: Храните сессию в секрете! Не коммитьте .telegram-session и .env.local в git!")
    print("")
    print("✅ Готово! Теперь можно использовать Telegram Client API.")
    
    client.disconnect()
    
except KeyboardInterrupt:
    print("\n❌ Прервано пользователем")
    sys.exit(1)
except Exception as error:
    print("")
    print("❌ Ошибка при получении сессии:")
    print(f"   Тип: {type(error).__name__}")
    print(f"   Сообщение: {str(error)}")
    print("")
    print("💡 Возможные решения:")
    print("   1. Проверьте правильность API_ID и API_HASH")
    print("   2. Убедитесь, что номер телефона введен с кодом страны (+7...)")
    print("   3. Проверьте код из Telegram (он приходит в приложение)")
    print("   4. Если включен 2FA, введите правильный пароль")
    print("   5. Попробуйте использовать Node.js скрипт (scripts/setup-telegram-session-improved.js)")
    
    try:
        client.disconnect()
    except:
        pass
    sys.exit(1)

