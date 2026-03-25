# Пошаговая инструкция: Подключение статических IP к кластеру

## 🎯 Цель

Подключить статические IP адреса к кластеру, чтобы:
- ✅ Поднимать поды с этих IP адресов
- ✅ Проверить валидацию Testnet (65.108.15.20) и Mainnet (65.108.15.19)

---

## 📋 Шаг 1: Определение ситуации

Сначала нужно понять, где находятся IP адреса:

### Вариант A: IP адреса на одном сервере (65.108.15.30)

Если IP адреса 65.108.15.20 и 65.108.15.19 находятся на том же сервере, что и 65.108.15.30:

```bash
# Подключитесь к серверу
ssh root@65.108.15.30

# Проверьте текущие IP адреса
ip addr show | grep "65.108.15"
```

**Если видите только 65.108.15.30** → нужно добавить остальные IP адреса (см. Шаг 2A)

**Если видите все три IP** → нужно только настроить маршрутизацию (см. Шаг 3A)

### Вариант B: IP адреса на разных серверах

Если IP адреса находятся на отдельных серверах:

```bash
# Проверьте доступность серверов
ping -c 2 65.108.15.20
ping -c 2 65.108.15.19
```

**Если серверы доступны** → подключите каждый как отдельную ноду (см. Шаг 2B)

---

## 🔧 Шаг 2A: Добавление IP адресов на существующую ноду

**Если IP адреса на одном сервере:**

### 2A.1: Подключение к серверу

```bash
ssh root@65.108.15.30
```

### 2A.2: Определение интерфейса

```bash
# Найдите основной интерфейс
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
echo "Интерфейс: $INTERFACE"

# Проверьте текущие IP
ip addr show $INTERFACE | grep "inet "
```

### 2A.3: Добавление IP адресов (временно)

```bash
# Добавьте IP адреса на интерфейс
ip addr add 65.108.15.20/24 dev $INTERFACE label ${INTERFACE}:testnet
ip addr add 65.108.15.19/24 dev $INTERFACE label ${INTERFACE}:mainnet

# Проверьте
ip addr show $INTERFACE | grep "65.108.15"
```

### 2A.4: Настройка netplan для постоянного сохранения

```bash
# Найдите файл netplan
NETPLAN_FILE=$(ls /etc/netplan/*.yaml 2>/dev/null | head -1)
echo "Файл netplan: $NETPLAN_FILE"

# Создайте резервную копию
cp $NETPLAN_FILE ${NETPLAN_FILE}.backup.$(date +%Y%m%d_%H%M%S)

# Отредактируйте файл
nano $NETPLAN_FILE
```

**Пример конфигурации netplan:**

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:  # Замените на ваш интерфейс
      dhcp4: false
      addresses:
        - 65.108.15.30/24  # Devnet
        - 65.108.15.20/24  # Testnet
        - 65.108.15.19/24  # Mainnet
      gateway4: <GATEWAY_IP>  # Замените на ваш gateway
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
```

**Примените изменения:**

```bash
netplan apply
```

### 2A.5: Перезапуск k3s agent

```bash
# Перезапустите k3s agent, чтобы он увидел новые IP
systemctl restart k3s-agent

# Проверьте статус
systemctl status k3s-agent
```

### 2A.6: Проверка в кластере

**На локальной машине:**

```bash
# Проверьте, что нода видит все IP адреса
kubectl get node canton-node-65-108-15-30 -o jsonpath='{.status.addresses}' | python3 -m json.tool
```

---

## 🔧 Шаг 2B: Подключение отдельных серверов к кластеру

**Если IP адреса на разных серверах:**

### 2B.1: Получение токена k3s

```bash
# На master ноде получите токен
K3S_TOKEN=$(ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token")
echo "Токен: $K3S_TOKEN"
```

### 2B.2: Подключение Testnet сервера (65.108.15.20)

```bash
# Подключитесь к серверу
ssh root@65.108.15.20

# Установите k3s agent
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME="canton-node-65-108-15-20"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка
sleep 5
sudo k3s kubectl get nodes
```

### 2B.3: Подключение Mainnet сервера (65.108.15.19)

```bash
# Подключитесь к серверу
ssh root@65.108.15.19

# Установите k3s agent
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.19"
NODE_NAME="canton-node-65-108-15-19"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка
sleep 5
sudo k3s kubectl get nodes
```

### 2B.4: Проверка в кластере

**На локальной машине:**

```bash
kubectl get nodes -o wide
```

**Должны увидеть:**
```
NAME                       STATUS   INTERNAL-IP      EXTERNAL-IP
canton-node-65-108-15-30  Ready    65.108.15.30     <none>
canton-node-65-108-15-20  Ready    65.108.15.20     <none>
canton-node-65-108-15-19  Ready    65.108.15.19     <none>
```

---

## 🔧 Шаг 3A: Настройка маршрутизации (если IP на одном сервере)

**Если все IP на одном сервере, нужно настроить маршрутизацию трафика:**

### 3A.1: Настройка iptables SNAT

```bash
# На сервере 65.108.15.30

# Для Testnet (65.108.15.20)
iptables -t nat -A OUTPUT \
  -p tcp \
  --dport 443 \
  -d scan.sv-1.testnet.global.canton.network.sync.global \
  -j SNAT --to-source 65.108.15.20

# Для Mainnet (65.108.15.19)
iptables -t nat -A OUTPUT \
  -p tcp \
  --dport 443 \
  -d scan.sv-1.global.canton.network.sync.global \
  -j SNAT --to-source 65.108.15.19

# Проверьте правила
iptables -t nat -L OUTPUT -n -v | grep "65.108.15"
```

### 3A.2: Сохранение правил iptables

```bash
# Сохраните правила
iptables-save > /etc/iptables/rules.v4

# Для автоматической загрузки при загрузке создайте скрипт
cat > /etc/network/if-up.d/iptables-restore << 'EOF'
#!/bin/bash
iptables-restore < /etc/iptables/rules.v4
EOF

chmod +x /etc/network/if-up.d/iptables-restore
```

**Или используйте готовый скрипт:**

```bash
bash blockchain/scripts/setup-multiple-ips-on-node.sh
```

---

## ✅ Шаг 4: Обновление манифестов для использования правильных нод

### 4.1: Обновление манифеста Testnet

**Если IP на одном сервере:**

```bash
# Манифест уже настроен на ноду canton-node-65-108-15-30
# Но нужно убедиться, что nodeSelector правильный

cat blockchain/k8s/ip-validation-testnet.yaml | grep -A 2 nodeSelector
```

**Если IP на разных серверах:**

```bash
# Обновите nodeSelector на правильную ноду
sed -i 's/canton-node-65-108-15-20/canton-node-65-108-15-20/g' \
  blockchain/k8s/ip-validation-testnet.yaml
```

### 4.2: Обновление манифеста Mainnet

**Аналогично для Mainnet:**

```bash
cat blockchain/k8s/ip-validation-mainnet.yaml | grep -A 2 nodeSelector
```

---

## 🚀 Шаг 5: Запуск проверки валидации

### 5.1: Проверка Testnet (65.108.15.20)

```bash
# Удалите предыдущий Job (если есть)
kubectl delete job ip-validation-checker-testnet -n default --ignore-not-found=true

# Запустите проверку
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml

# Смотрите результаты в реальном времени
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Или просмотрите полный отчет
kubectl logs -l job-name=ip-validation-checker-testnet --tail=200
```

### 5.2: Проверка Mainnet (65.108.15.19)

```bash
# Удалите предыдущий Job (если есть)
kubectl delete job ip-validation-checker-mainnet -n default --ignore-not-found=true

# Запустите проверку
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml

# Смотрите результаты в реальном времени
kubectl logs -l job-name=ip-validation-checker-mainnet -f

# Или просмотрите полный отчет
kubectl logs -l job-name=ip-validation-checker-mainnet --tail=200
```

---

## 🔍 Шаг 6: Проверка результатов

### Успешная валидация выглядит так:

```
✅ IP-адрес валидирован для Testnet/Mainnet!
   X из Y SV добавили IP (Z%)
   Требование 2/3 выполнено
```

### Частичная валидация:

```
⏳ IP-адрес частично валидирован
   X из Y SV добавили IP (Z%)
   Ожидайте 2-7 дней, пока остальные SV обновят allowlist
```

### Неудачная валидация:

```
❌ IP-адрес НЕ валидирован
   Не удалось подключиться к Super Validators
```

---

## 🛠️ Troubleshooting

### Проблема: IP адрес не виден в кластере

**Решение:**
```bash
# На сервере проверьте IP
ip addr show | grep "65.108.15"

# Перезапустите k3s agent
systemctl restart k3s-agent

# Проверьте логи
journalctl -u k3s-agent -f
```

### Проблема: Pod не запускается на нужной ноде

**Решение:**
```bash
# Проверьте nodeSelector в манифесте
cat blockchain/k8s/ip-validation-testnet.yaml | grep -A 2 nodeSelector

# Проверьте, что нода существует
kubectl get nodes | grep "65.108.15"

# Проверьте taints на ноде
kubectl describe node canton-node-65-108-15-30 | grep Taints
```

### Проблема: Исходящий трафик идет с неправильного IP

**Решение:**
```bash
# Проверьте правила iptables
iptables -t nat -L OUTPUT -n -v | grep "65.108.15"

# Если правил нет, добавьте их (см. Шаг 3A)
```

### Проблема: Все тесты показывают TIMEOUT

**Решение:**
1. Проверьте whitelisting у SV sponsor
2. Проверьте сетевую доступность: `curl -v https://scan.sv-1.testnet.global.canton.network.sync.global`
3. Проверьте firewall правила
4. Для Mainnet: убедитесь, что получен allocation

---

## 📋 Чеклист

- [ ] Определена ситуация (IP на одном сервере или разных)
- [ ] Добавлены IP адреса на интерфейс (если на одном сервере)
- [ ] Настроен netplan для постоянного сохранения
- [ ] Перезапущен k3s agent
- [ ] Проверено, что ноды видны в кластере
- [ ] Настроена маршрутизация iptables (если на одном сервере)
- [ ] Обновлены манифесты с правильными nodeSelector
- [ ] Запущена проверка валидации Testnet
- [ ] Запущена проверка валидации Mainnet
- [ ] Проверены результаты валидации

---

## 🚀 Быстрый скрипт для автоматизации

Создайте скрипт `blockchain/scripts/connect-all-ips-to-cluster.sh`:

```bash
#!/bin/bash
# Автоматическое подключение всех IP адресов к кластеру

# Определите ситуацию и выполните соответствующие шаги
# См. полную инструкцию выше
```

---

**Последнее обновление**: $(date +"%Y-%m-%d")





