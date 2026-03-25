# 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ NGINX PORT 80

## Проблема
- ✅ Nginx контейнер работает корректно изнутри (возвращает 200 OK)
- ❌ Внешние запросы на `http://65.108.15.30/wallet/` возвращают 404
- ❌ Внешние запросы не попадают в логи nginx контейнера

## Результаты диагностики

### 1. Процессы на порту 80
```bash
ss -tlnp | grep ':80 '
# LISTEN 0 4096 0.0.0.0:80 0.0.0.0:* users:(("docker-proxy",pid=3140424,fd=7))
```

**Вывод:** Порт 80 слушает `docker-proxy` (Docker port mapping)

### 2. Kubernetes CNI перехватывает порт 80
```bash
iptables -t nat -L -n | grep -E '80|DNAT'
# DNAT ... tcp dpt:80 to:10.42.2.166:80
```

**КРИТИЧЕСКИЙ ВЫВОД:** Kubernetes CNI (k3s) перехватывает порт 80 и перенаправляет на IP `10.42.2.166:80` (Kubernetes сервис), а НЕ на Docker контейнер!

### 3. Nginx контейнер
- **Имя:** `splice-validator-nginx-1`
- **IP в Docker сети:** `172.18.0.7/16` (сеть `splice-validator_splice_validator`)
- **Порт mapping:** `0.0.0.0:80->80/tcp`
- **Статус:** Running (healthy)
- **Изнутри контейнера работает:** ✅ `/wallet/`, `/ans/`, `/health` возвращают 200 OK

### 4. Проверка доступности изнутри контейнера
```bash
docker exec splice-validator-nginx-1 curl -s http://127.0.0.1/wallet/
# ✅ Возвращает HTML (200 OK)

docker exec splice-validator-nginx-1 curl -s http://wallet-web-ui:8080/
# ✅ Возвращает HTML (200 OK)
```

### 5. Внешние запросы
```bash
curl -I http://65.108.15.30/wallet/
# ❌ HTTP/1.1 404 Not Found
# ❌ Не попадают в логи nginx контейнера
```

## Причина проблемы

**Kubernetes CNI (k3s) перехватывает порт 80 ДО того, как запросы доходят до Docker контейнера.**

В iptables есть правило:
```
DNAT ... tcp dpt:80 to:10.42.2.166:80
```

Это означает, что все запросы на порт 80 перенаправляются на Kubernetes сервис с IP `10.42.2.166:80`, а не на Docker контейнер `splice-validator-nginx-1`.

## Решения

### Решение 1: Изменить порт Docker контейнера (РЕКОМЕНДУЕТСЯ)

Изменить порт nginx контейнера на другой (например, 8080) и использовать Kubernetes Ingress или другой порт для внешнего доступа.

**Шаги:**
1. Изменить `compose.yaml`:
   ```yaml
   nginx:
     ports:
       - "8080:80"  # Вместо "80:80"
   ```

2. Перезапустить:
   ```bash
   docker compose -f /opt/canton-validator/compose.yaml restart nginx
   ```

3. Доступ будет через: `http://65.108.15.30:8080/wallet/`

### Решение 2: Удалить Kubernetes сервис, использующий порт 80

Найти и удалить Kubernetes сервис, который перехватывает порт 80.

**Шаги:**
1. Найти сервис:
   ```bash
   kubectl get svc -A -o wide | grep -E '80|:80'
   kubectl get endpoints -A | grep 10.42.2.166
   ```

2. Проверить, что это за сервис:
   ```bash
   kubectl describe svc <service-name> -n <namespace>
   ```

3. Если это не нужный сервис, удалить или изменить его порт:
   ```bash
   kubectl delete svc <service-name> -n <namespace>
   # ИЛИ изменить порт в манифесте сервиса
   ```

### Решение 3: Использовать Kubernetes Ingress для маршрутизации

Создать Kubernetes Ingress, который будет проксировать запросы к Docker контейнеру.

**Шаги:**
1. Создать NodePort сервис для nginx контейнера:
   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: canton-nginx
     namespace: default
   spec:
     type: NodePort
     ports:
     - port: 80
       targetPort: 80
       nodePort: 30080
     selector:
       # Нужно добавить labels к nginx контейнеру
   ```

2. Создать Ingress:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: canton-nginx-ingress
   spec:
     rules:
     - host: 65.108.15.30
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: canton-nginx
               port:
                 number: 80
   ```

### Решение 4: Отключить CNI port mapping для порта 80

Отключить Kubernetes CNI port mapping для порта 80 (требует прав администратора кластера).

**ВНИМАНИЕ:** Это может сломать другие сервисы Kubernetes, использующие порт 80.

## Рекомендуемое решение

**Использовать Решение 1** - изменить порт Docker контейнера на 8080, так как:
- ✅ Не требует изменения Kubernetes конфигурации
- ✅ Не влияет на другие сервисы
- ✅ Быстрое решение
- ✅ Минимальный риск

## Команды для применения Решения 1

```bash
# 1. Подключиться к серверу
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# 2. Создать backup compose.yaml
cd /opt/canton-validator
cp compose.yaml compose.yaml.backup.$(date +%Y%m%d_%H%M%S)

# 3. Изменить порт в compose.yaml
sed -i 's/"80:80"/"8080:80"/g' compose.yaml

# 4. Проверить изменения
grep -A 2 "nginx:" compose.yaml | grep ports

# 5. Перезапустить nginx
docker compose -f compose.yaml restart nginx

# 6. Проверить доступность
curl -I http://65.108.15.30:8080/wallet/
curl -I http://65.108.15.30:8080/ans/
curl -I http://65.108.15.30:8080/health
```

## Проверка после применения

```bash
# Проверить, что порт изменился
docker ps | grep nginx
# Должно быть: 0.0.0.0:8080->80/tcp

# Проверить доступность
curl -I http://65.108.15.30:8080/wallet/
# Должно быть: HTTP/1.1 200 OK

# Проверить логи
docker logs splice-validator-nginx-1 --tail=5
# Должны появиться записи о внешних запросах
```

## Альтернатива: Использовать другой IP

Если нужно использовать именно порт 80, можно:
1. Настроить отдельный IP адрес для Docker контейнера
2. Использовать другой интерфейс
3. Настроить маршрутизацию через iptables (более сложно)

---

**Дата диагностики:** 2025-11-29  
**Статус:** Проблема идентифицирована - Kubernetes CNI перехватывает порт 80  
**Рекомендуемое решение:** Изменить порт Docker контейнера на 8080
