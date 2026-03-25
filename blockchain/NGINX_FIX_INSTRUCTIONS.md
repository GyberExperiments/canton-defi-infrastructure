# 🔧 ИСПРАВЛЕНИЕ NGINX КОНФИГУРАЦИИ

## Проблема
Nginx возвращает HTTP 404 для веб-интерфейсов:
- `http://65.108.15.30/wallet` - HTTP 404
- `http://65.108.15.30/ans` - HTTP 404
- `http://65.108.15.30/` - HTTP 404

## Причина
Конфигурация nginx не настроена для маршрутизации запросов к `wallet-web-ui` и `ans-web-ui`.

## Решение

### Шаг 1: Скопировать nginx.conf на сервер

```bash
# На локальной машине (если есть доступ к серверу)
scp blockchain/nginx.conf root@65.108.15.30:/opt/canton-validator/nginx.conf

# ИЛИ на сервере напрямую
# Создать файл /opt/canton-validator/nginx.conf с содержимым из blockchain/nginx.conf
```

### Шаг 2: Проверить, что compose.yaml монтирует nginx.conf

```bash
# На сервере
cd /opt/canton-validator

# Проверить, что nginx.conf монтируется в compose.yaml
grep -A 5 "nginx:" compose.yaml | grep -A 3 "volumes:"

# Должно быть что-то вроде:
# volumes:
#   - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### Шаг 3: Если nginx.conf не монтируется в compose.yaml

#### Вариант A: Добавить volume mount в compose.yaml

```bash
# На сервере
cd /opt/canton-validator

# Создать backup
cp compose.yaml compose.yaml.backup.$(date +%Y%m%d_%H%M%S)

# Добавить volume mount для nginx (если его нет)
# Найти секцию nginx: в compose.yaml и добавить volumes:
```

Пример секции nginx в compose.yaml:
```yaml
nginx:
  image: nginx:${NGINX_VERSION}
  container_name: splice-validator-nginx-1
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
  depends_on:
    wallet-web-ui:
      condition: service_healthy
    ans-web-ui:
      condition: service_healthy
    validator:
      condition: service_healthy
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 10s
```

#### Вариант B: Использовать ConfigMap (если в Kubernetes)

Если nginx запущен в Kubernetes, создать ConfigMap:

```bash
kubectl create configmap nginx-config \
  --from-file=nginx.conf=blockchain/nginx.conf \
  -n <namespace> --dry-run=client -o yaml | kubectl apply -f -
```

### Шаг 4: Перезапустить nginx

```bash
# На сервере
cd /opt/canton-validator

# Перезапустить только nginx
docker compose restart nginx

# ИЛИ перезапустить весь стек
docker compose down
docker compose up -d
```

### Шаг 5: Проверить конфигурацию nginx

```bash
# Проверить синтаксис конфигурации
docker exec splice-validator-nginx-1 nginx -t

# Проверить логи nginx
docker logs splice-validator-nginx-1 --tail=50

# Проверить доступность
curl -I http://localhost/wallet
curl -I http://localhost/ans
curl -I http://localhost/health
```

### Шаг 6: Проверить доступность снаружи

```bash
# С локальной машины
curl -I http://65.108.15.30/wallet
curl -I http://65.108.15.30/ans
curl -I http://65.108.15.30/health
```

## Ожидаемый результат

После применения конфигурации:

✅ `http://65.108.15.30/wallet` - должен возвращать HTTP 200 (Wallet UI)  
✅ `http://65.108.15.30/ans` - должен возвращать HTTP 200 (ANS UI)  
✅ `http://65.108.15.30/health` - должен возвращать HTTP 200 "healthy"  
✅ `http://65.108.15.30/` - должен редиректить на `/wallet`

## Структура конфигурации

- `/wallet` → `wallet-web-ui:8080`
- `/ans` → `ans-web-ui:8080`
- `/api` → `validator:5003`
- `/health` → health check endpoint
- `/` → редирект на `/wallet`

## Troubleshooting

### Если nginx все еще возвращает 404:

1. **Проверить, что конфигурация применена:**
   ```bash
   docker exec splice-validator-nginx-1 cat /etc/nginx/nginx.conf | grep -A 5 "location /wallet"
   ```

2. **Проверить, что контейнеры доступны:**
   ```bash
   docker exec splice-validator-nginx-1 ping -c 1 wallet-web-ui
   docker exec splice-validator-nginx-1 ping -c 1 ans-web-ui
   ```

3. **Проверить логи nginx:**
   ```bash
   docker logs splice-validator-nginx-1 --tail=100 | grep -i error
   ```

4. **Проверить, что веб-интерфейсы работают напрямую:**
   ```bash
   docker exec splice-validator-nginx-1 curl -I http://wallet-web-ui:8080
   docker exec splice-validator-nginx-1 curl -I http://ans-web-ui:8080
   ```

### Если конфигурация не применяется:

1. **Проверить права доступа:**
   ```bash
   ls -la /opt/canton-validator/nginx.conf
   chmod 644 /opt/canton-validator/nginx.conf
   ```

2. **Проверить, что файл монтируется:**
   ```bash
   docker inspect splice-validator-nginx-1 | grep -A 10 "Mounts"
   ```

3. **Пересоздать контейнер nginx:**
   ```bash
   docker compose stop nginx
   docker compose rm -f nginx
   docker compose up -d nginx
   ```

---

**Дата создания**: 2025-11-28  
**Статус**: Готово к применению
