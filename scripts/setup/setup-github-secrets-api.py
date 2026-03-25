#!/usr/bin/env python3
"""
🔐 Canton OTC - Установка GitHub Secrets через API
Этот скрипт устанавливает все секреты в GitHub репозиторий используя GitHub API
"""

import os
import sys
import json
import base64
import requests
from pathlib import Path
from getpass import getpass
from urllib.parse import quote

# Конфигурация
REPO_OWNER = "TheMacroeconomicDao"
REPO_NAME = "CantonOTC"
ENV_FILE = ".env.production"

def load_env_file(file_path):
    """Читает .env файл и возвращает словарь переменных"""
    env_vars = {}
    if not os.path.exists(file_path):
        print(f"❌ Файл {file_path} не найден!")
        return None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                # Убираем кавычки если есть
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                env_vars[key] = value
    
    return env_vars

def get_github_token():
    """Получает GitHub token"""
    # Проверяем аргументы командной строки
    if len(sys.argv) > 1:
        token = sys.argv[1].strip()
        if token:
            return token
    
    # Проверяем переменную окружения
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        return token
    
    # Информируем пользователя
    print("\n🔑 Нужен GitHub Personal Access Token с правами 'repo' и 'admin:org'")
    print("📋 Создайте токен: https://github.com/settings/tokens")
    print("✅ Выберите scopes: repo, admin:org")
    print("\n💡 Способы передать токен:")
    print("   python3 setup-github-secrets-api.py YOUR_TOKEN")
    print("   export GITHUB_TOKEN=YOUR_TOKEN && python3 setup-github-secrets-api.py")
    
    return None

def get_repo_public_key(token):
    """Получает публичный ключ репозитория для шифрования секретов"""
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/public-key"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Ошибка получения публичного ключа: {response.status_code}")
        print(f"📄 Ответ: {response.text}")
        return None

def encrypt_secret(public_key, secret_value):
    """Шифрует секрет используя публичный ключ репозитория"""
    try:
        from nacl import encoding, public
    except ImportError:
        print("❌ Нужна библиотека PyNaCl: pip install PyNaCl")
        return None
    
    # Декодируем публичный ключ из base64
    public_key_bytes = base64.b64decode(public_key)
    
    # Создаем объект публичного ключа
    sealed_box = public.SealedBox(public.PublicKey(public_key_bytes))
    
    # Шифруем секрет
    encrypted = sealed_box.encrypt(secret_value.encode('utf-8'))
    
    # Возвращаем в base64
    return base64.b64encode(encrypted).decode('utf-8')

def set_secret(token, secret_name, secret_value, key_id, public_key):
    """Устанавливает секрет в GitHub репозиторий"""
    # Шифруем секрет
    encrypted_value = encrypt_secret(public_key, secret_value)
    if not encrypted_value:
        return False
    
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/secrets/{secret_name}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    
    data = {
        "encrypted_value": encrypted_value,
        "key_id": key_id
    }
    
    response = requests.put(url, headers=headers, json=data)
    
    if response.status_code in [201, 204]:
        print(f"✅ {secret_name} установлен")
        return True
    else:
        print(f"❌ Ошибка установки {secret_name}: {response.status_code}")
        print(f"📄 Ответ: {response.text}")
        return False

def generate_kubeconfig_base64():
    """Генерирует base64 от kubeconfig файла"""
    kubeconfig_path = os.path.expanduser("~/.kube/config")
    if os.path.exists(kubeconfig_path):
        with open(kubeconfig_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return None

def generate_random_secret():
    """Генерирует случайный секрет"""
    import secrets
    return base64.b64encode(secrets.token_bytes(32)).decode('utf-8')

def main():
    print("🔐 Canton OTC - Установка GitHub Secrets через API")
    print("=" * 55)
    
    # Загружаем переменные из .env файла
    print(f"📄 Читаем секреты из {ENV_FILE}...")
    env_vars = load_env_file(ENV_FILE)
    if not env_vars:
        return 1
    
    # Получаем GitHub token
    token = get_github_token()
    if not token:
        print("❌ GitHub token не предоставлен!")
        return 1
    
    # Получаем публичный ключ репозитория
    print("\n🔑 Получаем публичный ключ репозитория...")
    key_info = get_repo_public_key(token)
    if not key_info:
        return 1
    
    key_id = key_info['key_id']
    public_key = key_info['key']
    print(f"✅ Публичный ключ получен (ID: {key_id})")
    
    # Подготавливаем секреты
    secrets_to_set = {}
    
    # Обязательные секреты из .env файла
    required_secrets = [
        'GOOGLE_SHEET_ID',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL', 
        'GOOGLE_PRIVATE_KEY',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID',
        'SMTP_HOST',
        'SMTP_PORT', 
        'SMTP_SECURE',
        'SMTP_FROM_ADDRESS',
        'SMTP_FROM_NAME',
        'USDT_RECEIVING_ADDRESS',
        'CANTON_COIN_PRICE_USD',
        'ADMIN_API_KEY',
        'NEXTAUTH_SECRET',
        'NEXTAUTH_URL'
    ]
    
    # Добавляем секреты из файла
    for secret_name in required_secrets:
        if secret_name in env_vars and env_vars[secret_name]:
            secrets_to_set[secret_name] = env_vars[secret_name]
    
    # Добавляем KUBECONFIG
    print("\n🔑 Обрабатываем KUBECONFIG...")
    kubeconfig_base64 = generate_kubeconfig_base64()
    if kubeconfig_base64:
        secrets_to_set['KUBECONFIG'] = kubeconfig_base64
        print("✅ KUBECONFIG подготовлен")
    else:
        print("⚠️  ~/.kube/config не найден, пропускаем KUBECONFIG")
    
    # Генерируем недостающие секреты
    if 'ADMIN_API_KEY' not in secrets_to_set:
        secrets_to_set['ADMIN_API_KEY'] = generate_random_secret()
        print("🎲 Сгенерирован ADMIN_API_KEY")
    
    if 'NEXTAUTH_SECRET' not in secrets_to_set:
        secrets_to_set['NEXTAUTH_SECRET'] = generate_random_secret()
        print("🎲 Сгенерирован NEXTAUTH_SECRET")
    
    if 'NEXTAUTH_URL' not in secrets_to_set:
        secrets_to_set['NEXTAUTH_URL'] = "https://1otc.cc"
        print("🌐 Установлен NEXTAUTH_URL")
    
    # Устанавливаем секреты
    print(f"\n🚀 Устанавливаем {len(secrets_to_set)} секретов в GitHub...")
    success_count = 0
    
    for secret_name, secret_value in secrets_to_set.items():
        if set_secret(token, secret_name, secret_value, key_id, public_key):
            success_count += 1
    
    print(f"\n📊 Результат: {success_count}/{len(secrets_to_set)} секретов установлено")
    
    if success_count == len(secrets_to_set):
        print("🎉 Все секреты успешно установлены!")
        print("\n🚀 Готово к деплою!")
        print("Теперь можно запустить GitHub Actions workflow:")
        print("  1. Автоматически: git push origin main")
        print("  2. Вручную: GitHub Actions → Deploy Canton OTC to Kubernetes → Run workflow")
        return 0
    else:
        print("❌ Некоторые секреты не удалось установить")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Прервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Неожиданная ошибка: {e}")
        sys.exit(1)
