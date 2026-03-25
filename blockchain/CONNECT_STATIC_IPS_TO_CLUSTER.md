# Подключение статических IP адресов к кластеру

## 📋 Ситуация

У вас есть **статические IP адреса** для валидации:
- **Testnet**: 65.108.15.20
- **Mainnet**: 65.108.15.19

Эти IP могут быть:
1. **Дополнительными IP на том же сервере**, что и Devnet (65.108.15.30)
2. **Отдельными серверами** с этими IP адресами

---

## 🔍 Вариант 1: Дополнительные IP на существующей ноде

Если IP адреса 65.108.15.20 и 65.108.15.19 находятся на том же сервере, что и 65.108.15.30, нужно:

### Шаг 1: Настройка дополнительных IP на сервере

**Подключитесь к серверу с IP 65.108.15.30:**

```bash
ssh root@65.108.15.30
```

**Проверьте текущие IP адреса:**
```bash
ip addr show
```

**Добавьте дополнительные IP адреса:**

#### Для Ubuntu/Debian (через netplan):

```bash
# 1. Найдите имя интерфейса
ip link show | grep -E "^[0-9]+:" | head -1

# 2. Отредактируйте конфигурацию netplan
# Обычно файл находится в /etc/netplan/50-cloud-init.yaml или /etc/netplan/01-netcfg.yaml
nano /etc/netplan/50-cloud-init.yaml
```

**Пример конфигурации netplan с несколькими IP:**

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:  # Замените на ваш интерфейс
      dhcp4: false
      addresses:
        - 65.108.15.30/24  # Основной IP (Devnet)
        - 65.108.15.20/24  # Testnet
        - 65.108.15.19/24  # Mainnet
      gateway4: <GATEWAY_IP>
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

**Примените изменения:**
```bash
netplan apply
```

#### Для систем с ifconfig (старый способ):

```bash
# Добавьте дополнительные IP адреса
ip addr add 65.108.15.20/24 dev eth0
ip addr add 65.108.15.19/24 dev eth0

# Проверьте
ip addr show eth0
```

**Для постоянного сохранения добавьте в `/etc/network/interfaces`:**

```bash
# /etc/network/interfaces
auto eth0
iface eth0 inet static
    address 65.108.15.30
    netmask 255.255.255.0
    gateway <GATEWAY_IP>

auto eth0:0
iface eth0:0 inet static
    address 65.108.15.20
    netmask 255.255.255.0

auto eth0:1
iface eth0:1 inet static
    address 65.108.15.19
    netmask 255.255.255.0
```

### Шаг 2: Настройка k3s для работы с несколькими IP

**Если нода уже подключена к кластеру**, k3s автоматически увидит все IP адреса. Но для использования конкретного IP нужно настроить манифесты с `hostNetwork: true` и правильным `nodeSelector`.

**Проверьте, что нода видит все IP:**
```bash
kubectl get node canton-node-65-108-15-30 -o jsonpath='{.status.addresses}' | python3 -m json.tool
```

### Шаг 3: Обновление манифестов для использования правильного IP

**Для проверки IP валидации** манифесты уже настроены на использование `hostNetwork: true`, что означает, что Pod будет использовать IP адрес ноды. Но нужно убедиться, что трафик идет с правильного IP.

**Создайте скрипт для привязки IP к интерфейсу перед запуском Pod:**

```bash
# Создайте скрипт /usr/local/bin/bind-ip.sh
cat > /usr/local/bin/bind-ip.sh << 'EOF'
#!/bin/bash
# Привязка IP адреса к интерфейсу для конкретного Pod

IP=$1
INTERFACE=${2:-eth0}

if [ -z "$IP" ]; then
    echo "Usage: $0 <IP_ADDRESS> [INTERFACE]"
    exit 1
fi

# Проверяем, существует ли IP
if ! ip addr show | grep -q "$IP"; then
    echo "IP $IP не найден на интерфейсе"
    exit 1
fi

# Устанавливаем IP как основной для исходящих соединений
ip route add default via $(ip route | grep default | awk '{print $3}') src $IP 2>/dev/null || true
EOF

chmod +x /usr/local/bin/bind-ip.sh
```

---

## 🔍 Вариант 2: Отдельные серверы с этими IP

Если IP адреса находятся на отдельных серверах, нужно подключить их к кластеру как отдельные ноды.

### Шаг 1: Подключение сервера Testnet (65.108.15.20)

```bash
# 1. Получите токен k3s на master ноде
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 2. На сервере 65.108.15.20 выполните:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME="canton-node-65-108-15-20"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

# Установка k3s agent
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка подключения
sleep 5
sudo k3s kubectl get nodes
```

### Шаг 2: Подключение сервера Mainnet (65.108.15.19)

```bash
# 1. Получите токен k3s на master ноде (тот же токен)
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 2. На сервере 65.108.15.19 выполните:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.19"
NODE_NAME="canton-node-65-108-15-19"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

# Установка k3s agent
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка подключения
sleep 5
sudo k3s kubectl get nodes
```

### Шаг 3: Проверка подключения

**На локальной машине с kubectl:**

```bash
kubectl get nodes -o wide
```

Вы должны увидеть:
```
NAME                       STATUS   INTERNAL-IP      EXTERNAL-IP
canton-node-65-108-15-30  Ready    65.108.15.30     <none>
canton-node-65-108-15-20  Ready    65.108.15.20     <none>
canton-node-65-108-15-19  Ready    65.108.15.19     <none>
```

---

## 🎯 Рекомендуемый подход: Использование hostNetwork с привязкой IP

Для валидации IP адресов лучше всего использовать `hostNetwork: true` в Pod манифестах, но при этом нужно убедиться, что исходящий трафик идет с правильного IP.

### Обновление манифестов для работы с несколькими IP на одной ноде

Если все IP на одной ноде, обновите манифесты:

```yaml
# blockchain/k8s/ip-validation-testnet.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ip-validation-checker-testnet
spec:
  template:
    spec:
      hostNetwork: true
      nodeSelector:
        kubernetes.io/hostname: canton-node-65-108-15-30  # Та же нода
      containers:
      - name: validator
        image: curlimages/curl:latest
        command: ["/bin/sh"]
        args:
          - -c
          - |
            # Устанавливаем исходный IP для исходящих соединений
            ip route add default via $(ip route | grep default | awk '{print $3}') src 65.108.15.20 2>/dev/null || true
            
            # Проверка IP
            CURRENT_IP=$(curl -sSL --interface 65.108.15.20 http://checkip.amazonaws.com 2>/dev/null || curl -sSL http://checkip.amazonaws.com)
            echo "IP: $CURRENT_IP"
            
            # Остальной код проверки...
```

**Но curl не всегда поддерживает `--interface`**, поэтому лучше использовать другой подход.

### Альтернативный подход: Использование iptables для маршрутизации

```bash
# На сервере создайте правила маршрутизации
# Для Testnet (65.108.15.20)
iptables -t nat -A OUTPUT -p tcp --dport 443 -d scan.sv-1.testnet.global.canton.network.sync.global -j SNAT --to-source 65.108.15.20

# Для Mainnet (65.108.15.19)
iptables -t nat -A OUTPUT -p tcp --dport 443 -d scan.sv-1.global.canton.network.sync.global -j SNAT --to-source 65.108.15.19
```

---

## ✅ Проверка после настройки

### 1. Проверка IP адресов на сервере

```bash
# На сервере выполните:
ip addr show | grep -E "65.108.15.(19|20|30)"
```

### 2. Проверка подключения нод к кластеру

```bash
kubectl get nodes -o wide | grep -E "65.108.15.(19|20|30)"
```

### 3. Запуск проверки валидации

```bash
# Testnet
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Mainnet
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker-mainnet -f
```

---

## 🔧 Troubleshooting

### Проблема: IP адрес не виден в кластере

**Решение:**
1. Проверьте, что IP настроен на сервере: `ip addr show`
2. Перезапустите k3s agent: `sudo systemctl restart k3s-agent`
3. Проверьте логи: `sudo journalctl -u k3s-agent -f`

### Проблема: Pod не видит правильный IP

**Решение:**
1. Убедитесь, что используется `hostNetwork: true`
2. Проверьте `nodeSelector` - он должен указывать на правильную ноду
3. Проверьте, что IP адрес действительно на этой ноде

### Проблема: Исходящий трафик идет с неправильного IP

**Решение:**
1. Используйте iptables для SNAT (см. выше)
2. Или настройте маршрутизацию через `ip route`
3. Или используйте отдельные серверы для каждого IP

---

## 📝 Рекомендации

1. **Если IP на одном сервере**: Используйте iptables SNAT для маршрутизации трафика с правильного IP
2. **Если IP на разных серверах**: Подключите каждый сервер как отдельную ноду к кластеру
3. **Для валидации**: Используйте `hostNetwork: true` в манифестах проверки

---

**Последнее обновление**: $(date +"%Y-%m-%d")





