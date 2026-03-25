#!/usr/bin/env python3
"""
Генератор согласованных JWT токенов для Supabase
"""
import jwt
import secrets
import sys

def generate_jwt_secret():
    """Генерирует криптографически безопасный JWT секрет"""
    return secrets.token_urlsafe(48)

def generate_postgres_password():
    """Генерирует безопасный пароль для PostgreSQL"""
    return secrets.token_urlsafe(32)

def generate_anon_key(jwt_secret):
    """Генерирует ANON_KEY с правильной подписью"""
    payload = {
        "iss": "supabase",
        "ref": "localhost",
        "role": "anon",
        "iat": 1641769200,
        "exp": 1957345200
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")

def generate_service_role_key(jwt_secret):
    """Генерирует SERVICE_ROLE_KEY с правильной подписью"""
    payload = {
        "iss": "supabase",
        "ref": "localhost",
        "role": "service_role",
        "iat": 1641769200,
        "exp": 1957345200
    }
    return jwt.encode(payload, jwt_secret, algorithm="HS256")

def verify_tokens(jwt_secret, anon_key, service_role_key):
    """Проверяет что токены валидны с данным JWT_SECRET"""
    try:
        jwt.decode(anon_key, jwt_secret, algorithms=["HS256"])
        jwt.decode(service_role_key, jwt_secret, algorithms=["HS256"])
        return True
    except jwt.InvalidSignatureError:
        return False

def main():
    print("🔐 Генерация согласованных Supabase секретов\n")
    
    # Генерация секретов
    jwt_secret = generate_jwt_secret()
    postgres_password = generate_postgres_password()
    anon_key = generate_anon_key(jwt_secret)
    service_role_key = generate_service_role_key(jwt_secret)
    
    # Проверка согласованности
    if not verify_tokens(jwt_secret, anon_key, service_role_key):
        print("❌ ОШИБКА: Токены не прошли проверку!")
        sys.exit(1)
    
    print("✅ Все токены сгенерированы и проверены\n")
    
    # Вывод для добавления в GitHub Secrets
    print("=" * 80)
    print("ДОБАВЬТЕ ЭТИ СЕКРЕТЫ В GITHUB SECRETS:")
    print("=" * 80)
    print(f"\nSUPABASE_JWT_SECRET={jwt_secret}")
    print(f"\nSUPABASE_POSTGRES_PASSWORD={postgres_password}")
    print(f"\nSUPABASE_ANON_KEY={anon_key}")
    print(f"\nSUPABASE_SERVICE_ROLE_KEY={service_role_key}")
    print("\n" + "=" * 80)
    print("\n⚠️  ВНИМАНИЕ: Сохраните эти значения в безопасном месте!")
    print("После добавления в GitHub Secrets, удалите этот вывод.")
    print("\nДля RSA ключей выполните:")
    print("./generate-rsa-keys.sh")

if __name__ == "__main__":
    try:
        import jwt
    except ImportError:
        print("❌ ОШИБКА: Установите PyJWT: pip3 install pyjwt")
        sys.exit(1)
    
    main()