# ⚡ БЫСТРОЕ РЕШЕНИЕ: NGINX PORT 80 КОНФЛИКТ

## Проблема
Kubernetes CNI перехватывает порт 80, запросы не доходят до Docker контейнера nginx.

## Решение: Изменить порт на 8080

### Команды для выполнения:

```bash
# 1. Подключиться к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# 2. Перейти в директорию
cd /opt/canton-validator

# 3. Создать backup
cp compose.yaml compose.yaml.backup.$(date +%Y%m%d_%H%M%S)

# 4. Изменить порт 80 на 8080
sed -i 's/"80:80"/"8080:80"/g' compose.yaml
sed -i "s/'80:80'/'8080:80'/g" compose.yaml
sed -i 's/80:80/8080:80/g' compose.yaml

# 5. Проверить изменения
grep -A 3 "nginx:" compose.yaml | grep -A 2 "ports:"

# 6. Перезапустить nginx
docker compose -f compose.yaml restart nginx

# 7. Проверить статус
docker ps | grep nginx
# Должно быть: 0.0.0.0:8080->80/tcp

# 8. Проверить доступность
curl -I http://65.108.15.30:8080/wallet/
curl -I http://65.108.15.30:8080/ans/
curl -I http://65.108.15.30:8080/health
```

### Ожидаемый результат:

```
HTTP/1.1 200 OK
Content-Type: text/html
```

### После применения:

- ✅ Wallet UI: `http://65.108.15.30:8080/wallet/`
- ✅ ANS UI: `http://65.108.15.30:8080/ans/`
- ✅ Health: `http://65.108.15.30:8080/health`

---

**Подробная диагностика:** `blockchain/NGINX_PORT_80_CONFLICT_DIAGNOSIS.md`
