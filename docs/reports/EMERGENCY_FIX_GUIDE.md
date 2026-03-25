# 🚨 ЭКСТРЕННОЕ РЕШЕНИЕ: Восстановление работы сайта при блокировке master-ноды

**Дата:** 16 декабря 2025  
**Проблема:** Hetzner заблокировал порты 23-65535 на master-ноде  
**Статус:** Kubernetes API недоступен, Service endpoints не обновляются

---

## 🎯 БЫСТРОЕ РЕШЕНИЕ

### Вариант 1: Обновить Traefik Ingress напрямую (РЕКОМЕНДУЕТСЯ)

Traefik может подключиться к подам напрямую. Нужно обновить Ingress для использования прямых IP адресов.

**IP адреса подов:**
- `10.42.2.228` - healthy (uptime: 7 дней)
- `10.42.2.83` - healthy (uptime: 7 дней)  
- `10.42.2.195` - healthy (uptime: 12 часов)

**Шаги:**

1. **Подключиться к worker-ноде:**
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
   ```

2. **Найти PID Traefik:**
   ```bash
   ps aux | grep traefik | grep -v grep
   # Должен показать PID (например, 1628919)
   ```

3. **Проверить доступность подов из Traefik:**
   ```bash
   TRAEFIK_PID=1628919  # Замените на реальный PID
   nsenter -t $TRAEFIK_PID -n curl -s http://10.42.2.228:3000/api/health
   ```

4. **Создать Traefik Middleware для прямого доступа:**

   Создайте файл `/tmp/traefik-direct-service.yaml`:
   ```yaml
   apiVersion: traefik.containo.us/v1alpha1
   kind: Middleware
   metadata:
     name: canton-otc-direct-backend
     namespace: canton-otc
   spec:
     forwardAuth:
       address: "http://10.42.2.228:3000"
   ```

   Но лучше использовать **IngressRoute** с прямыми сервисами.

### Вариант 2: Использовать nginx как промежуточный прокси

**Быстрое решение через nginx на worker-ноде:**

1. **Установить nginx (если не установлен):**
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30
   apt-get update && apt-get install -y nginx
   ```

2. **Создать конфигурацию nginx:**
   ```bash
   cat > /etc/nginx/sites-available/canton-otc-direct <<EOF
   upstream canton_otc_backend {
       server 10.42.2.228:3000;
       server 10.42.2.83:3000;
       server 10.42.2.195:3000;
       keepalive 32;
   }

   server {
       listen 8080;
       server_name 1otc.cc cantonotc.com canton-otc.com;

       location / {
           proxy_pass http://canton_otc_backend;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   ```

3. **Активировать конфигурацию:**
   ```bash
   ln -s /etc/nginx/sites-available/canton-otc-direct /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx
   ```

4. **Обновить Traefik Ingress для проксирования на nginx:8080**

   Но для этого нужен доступ к Kubernetes API, которого нет.

### Вариант 3: Обновить Endpoints через etcd напрямую

Если etcd доступен локально на worker-ноде:

```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30

# Найти etcd данные
ETCD_DATA="/var/lib/rancher/k3s/server/db"
# Или через k3s
k3s etcd-snapshot list 2>/dev/null || echo "etcd недоступен"
```

Этот метод сложен и требует глубокого понимания etcd.

---

## 🚀 САМОЕ ПРОСТОЕ РЕШЕНИЕ

**Использовать Traefik File Provider для статической конфигурации:**

1. **Создать статическую конфигурацию Traefik:**

   На worker-ноде создать файл `/tmp/traefik-static.yaml`:
   ```yaml
   http:
     routers:
       canton-otc-direct:
         rule: "Host(`1otc.cc`) || Host(`cantonotc.com`) || Host(`canton-otc.com`)"
         service: canton-otc-direct-service
         entryPoints:
           - websecure
         tls:
           certResolver: letsencrypt

     services:
       canton-otc-direct-service:
         loadBalancer:
           servers:
             - url: "http://10.42.2.228:3000"
             - url: "http://10.42.2.83:3000"
             - url: "http://10.42.2.195:3000"
   ```

2. **Настроить Traefik для использования File Provider:**

   Нужно обновить конфигурацию Traefik, что требует доступа к его конфигурационным файлам или перезапуска.

---

## 💡 РЕКОМЕНДАЦИЯ

**Пока ждем ответа от поддержки Hetzner:**

1. ✅ **Поды работают** - это главное
2. ✅ **Traefik может подключиться к подам** - проверено
3. ⏳ **Нужно обновить маршрутизацию** - варианты выше

**Самый безопасный вариант:** Дождаться ответа от поддержки Hetzner и разблокировки портов. После этого:
- Kubernetes API восстановится автоматически
- Service endpoints обновятся
- Сайт заработает

**Если нужно срочно восстановить работу:** Использовать Вариант 2 (nginx) как временный прокси, но это требует изменения конфигурации Traefik, что может быть сложно без доступа к Kubernetes API.

---

## 📋 ЧТО ДЕЛАТЬ СЕЙЧАС

1. ✅ **Диагностика завершена** - корневая причина найдена
2. ✅ **Поды работают** - приложение функционирует
3. ⏳ **Ждем ответа от поддержки Hetzner** - это главное
4. ⏳ **Мониторим ситуацию** - проверяем доступность сайта

**После разблокировки портов:**
- Kubernetes API восстановится автоматически
- K3s-agent подключится к master-ноде
- Service endpoints обновятся
- Сайт заработает полностью

---

**Статус:** Временное решение подготовлено, но рекомендуется дождаться разблокировки портов  
**Приоритет:** ВЫСОКИЙ - сайт частично работает, но статика и API недоступны
