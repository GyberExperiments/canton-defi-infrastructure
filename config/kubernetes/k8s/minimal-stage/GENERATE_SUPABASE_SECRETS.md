# 🔐 Генерация Supabase JWT секретов

## Требования
- OpenSSL установлен
- Python3 с библиотекой PyJWT установлена: `pip3 install pyjwt`

## Шаги генерации

### 1. Генерация JWT_SECRET (минимум 32 символа)
```bash
JWT_SECRET=$(openssl rand -base64 48)
echo "SUPABASE_JWT_SECRET=$JWT_SECRET"
```

### 2. Генерация POSTGRES_PASSWORD
```bash
POSTGRES_PASSWORD=$(openssl rand -base64 32)
echo "SUPABASE_POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
```

### 3. Генерация ANON_KEY с правильным JWT_SECRET
```python
import jwt
import time

jwt_secret = "ВАШ_JWT_SECRET_ИЗ_ШАГА_1"

payload = {
    "iss": "supabase",
    "ref": "localhost",
    "role": "anon",
    "iat": 1641769200,
    "exp": 1957345200
}

anon_key = jwt.encode(payload, jwt_secret, algorithm="HS256")
print(f"SUPABASE_ANON_KEY={anon_key}")
```

### 4. Генерация SERVICE_ROLE_KEY с правильным JWT_SECRET
```python
import jwt

jwt_secret = "ВАШ_JWT_SECRET_ИЗ_ШАГА_1"

payload = {
    "iss": "supabase",
    "ref": "localhost",
    "role": "service_role",
    "iat": 1641769200,
    "exp": 1957345200
}

service_role_key = jwt.encode(payload, jwt_secret, algorithm="HS256")
print(f"SUPABASE_SERVICE_ROLE_KEY={service_role_key}")
```

### 5. Генерация RSA ключей для GoTrue
```bash
# Генерация приватного ключа
openssl genrsa -out private_key.pem 2048

# Генерация публичного ключа
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Для GitHub Secrets нужно в одну строку с \n
PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private_key.pem)
PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public_key.pem)

echo "SUPABASE_RSA_PRIVATE_KEY=$PRIVATE_KEY"
echo "SUPABASE_RSA_PUBLIC_KEY=$PUBLIC_KEY"

# Удалить файлы после копирования
rm private_key.pem public_key.pem
```

## Добавление в GitHub Secrets

После генерации всех секретов, добавьте их в GitHub Secrets репозитория:

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте следующие секреты:
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_POSTGRES_PASSWORD`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (обновить существующий)
   - `SUPABASE_RSA_PRIVATE_KEY`
   - `SUPABASE_RSA_PUBLIC_KEY`

## Проверка согласованности

Убедитесь что ANON_KEY и SERVICE_ROLE_KEY подписаны тем же JWT_SECRET:

```python
import jwt

jwt_secret = "ВАШ_JWT_SECRET"
anon_key = "ВАШ_ANON_KEY"
service_role_key = "ВАШ_SERVICE_ROLE_KEY"

try:
    decoded_anon = jwt.decode(anon_key, jwt_secret, algorithms=["HS256"])
    print("✅ ANON_KEY валиден:", decoded_anon)
    
    decoded_service = jwt.decode(service_role_key, jwt_secret, algorithms=["HS256"])
    print("✅ SERVICE_ROLE_KEY валиден:", decoded_service)
except jwt.InvalidSignatureError:
    print("❌ ОШИБКА: JWT токены не соответствуют JWT_SECRET!")