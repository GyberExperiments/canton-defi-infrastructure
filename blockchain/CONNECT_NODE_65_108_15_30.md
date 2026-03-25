# 🚀 Подключение ноды 65.108.15.30 к k3s кластеру

## 📋 Данные для входа

- **IP**: 65.108.15.30
- **Username**: root
- **Password**: $CANTON_PASSWORD
- **Master IP**: 31.129.105.180

## ✅ Шаг 1: Подключение к серверу

```bash
ssh root@65.108.15.30
# Password: $GHCR_PASSWORD
```

## ✅ Шаг 2: Получение токена k3s

**На master ноде (31.129.105.180) или с локальной машины:**

```bash
# Вариант 1: С локальной машины (если есть SSH доступ)
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# Вариант 2: Подключитесь к master ноде отдельно
ssh root@31.129.105.180
sudo cat /var/lib/rancher/k3s/server/node-token
```

**Скопируйте токен** (начинается с `K10` или `K11`...)

## ✅ Шаг 3: Подключение ноды к кластеру

**На сервере 65.108.15.30 выполните:**

### Вариант 1: Использование готового скрипта

```bash
# Скачайте скрипт на сервер
curl -o /tmp/connect-node.sh https://raw.githubusercontent.com/TheMacroeconomicDao/CantonOTC/main/blockchain/scripts/connect-node-65-108-15-30.sh
# Или скопируйте содержимое скрипта вручную

chmod +x /tmp/connect-node.sh
/tmp/connect-node.sh
```

### Вариант 2: Ручное подключение (готовые команды)

```bash
# Установите переменные
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.30"
NODE_NAME=$(hostname)

# Вставьте токен вместо <TOKEN>
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

# Удалите старую версию k3s если установлена
/usr/local/bin/k3s-agent-uninstall.sh 2>/dev/null || true

# Подключение к кластеру
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка подключения
sleep 5
sudo k3s kubectl get nodes

# Сохраните hostname ноды
echo "Hostname ноды: $NODE_NAME"
```

## ✅ Шаг 4: Проверка на локальной машине

**На локальной машине с kubectl:**

```bash
# Проверьте, что нода появилась в кластере
kubectl get nodes -o wide

# Найдите ноду с IP 65.108.15.30 и запомните её NAME (hostname)
```

## ✅ Шаг 5: Развертывание валидатора

**На локальной машине:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 1. Обновите hostname в манифесте (замените <HOSTNAME> на реальный)
cd blockchain/scripts
./update-node-hostname.sh <HOSTNAME>

# 2. Разверните валидатора
cd ../../config/kubernetes/k8s
kubectl apply -f canton-validator-new-node.yaml

# 3. Проверьте статус
kubectl get pods -n canton-node -l node=new-validator -w
```

## 🔍 Проверка работы

```bash
# Health check
curl http://65.108.15.30:8081/health

# Логи
kubectl logs -f -n canton-node -l node=new-validator

# Статус пода
kubectl get pods -n canton-node -l node=new-validator
```

---

**Готово!** После подключения ноды можно развернуть валидатора.


















