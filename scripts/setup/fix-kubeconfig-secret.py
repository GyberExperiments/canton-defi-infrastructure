#!/usr/bin/env python3
"""
🔧 Canton OTC - Исправление секрета KUBECONFIG
Простой скрипт для установки только секрета KUBECONFIG в GitHub
"""

import os
import sys
import base64
import requests
from getpass import getpass

# Конфигурация
REPO_OWNER = "TheMacroeconomicDao"
REPO_NAME = "CantonOTC"

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
    print("\n🔑 Нужен GitHub Personal Access Token с правами 'repo'")
    print("📋 Создайте токен: https://github.com/settings/tokens")
    print("✅ Выберите scopes: repo")
    print("\n💡 Способы передать токен:")
    print("   python3 fix-kubeconfig-secret.py YOUR_TOKEN")
    print("   export GITHUB_TOKEN=YOUR_TOKEN && python3 fix-kubeconfig-secret.py")
    
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

def main():
    print("🔧 Canton OTC - Исправление секрета KUBECONFIG")
    print("=" * 50)
    
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
    
    # Генерируем KUBECONFIG
    print("\n🔑 Обрабатываем KUBECONFIG...")
    kubeconfig_base64 = generate_kubeconfig_base64()
    if not kubeconfig_base64:
        print("❌ ~/.kube/config не найден!")
        return 1
    
    print("✅ KUBECONFIG подготовлен")
    
    # Устанавливаем секрет
    print("\n🚀 Устанавливаем секрет KUBECONFIG в GitHub...")
    if set_secret(token, 'KUBECONFIG', kubeconfig_base64, key_id, public_key):
        print("\n🎉 Секрет KUBECONFIG успешно установлен!")
        print("\n🚀 Теперь можно запустить деплой:")
        print("  1. Автоматически: git push origin main")
        print("  2. Вручную: GitHub Actions → Deploy Canton OTC to Kubernetes → Run workflow")
        return 0
    else:
        print("❌ Не удалось установить секрет KUBECONFIG")
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

