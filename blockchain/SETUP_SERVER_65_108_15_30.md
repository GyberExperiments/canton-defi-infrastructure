# 🚀 Настройка сервера 65.108.15.30

## ⚠️ ВАЖНО: Сервер в Rescue System

Сервер находится в **Rescue System** и **не имеет установленной ОС**. Нужно сначала установить Ubuntu, затем подключить к кластеру.

## ✅ Шаг 1: Установка Ubuntu

**На сервере 65.108.15.30 в Rescue System:**

### Вариант 1: Автоматическая установка (рекомендуется)

```bash
# Установка Ubuntu 24.04
installimage

# В интерактивном режиме выберите:
# - OS: Ubuntu 24.04
# - Hostname: canton-node-65-108-15-30 (или свой)
# - Разметка диска: по умолчанию или кастомная
```

### Вариант 2: Быстрая установка через команду

```bash
# Установка Ubuntu 24.04 с настройками по умолчанию
installimage -a -n "canton-node-65-108-15-30" -r yes -l 0
```

**После установки перезагрузите сервер:**
```bash
reboot
```

## ✅ Шаг 2: Подключение к кластеру

**После перезагрузки подключитесь к серверу и выполните:**

```bash
# 1. Получите токен (на master ноде или с локальной машины)
# ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 2. На сервере 65.108.15.30 выполните:

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.30"
NODE_NAME="canton-node-65-108-15-30"  # Или используйте $(hostname)
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

# Установка зависимостей
apt-get update
apt-get install -y curl wget

# Установка k3s (используем конкретную версию вместо latest)
K3S_VERSION="v1.31.5+k3s1"
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка
sleep 5
k3s kubectl get nodes 2>/dev/null || echo "Проверка через kubectl на master ноде"
echo "Hostname: $NODE_NAME"
```

## ✅ Шаг 3: Проверка на локальной машине

```bash
kubectl get nodes -o wide
# Найдите ноду с IP 65.108.15.30
```

## ✅ Шаг 4: Развертывание валидатора

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Обновите hostname в манифесте
cd blockchain/scripts
./update-node-hostname.sh <HOSTNAME_НОДЫ>

# Разверните валидатора
cd ../../config/kubernetes/k8s
kubectl apply -f canton-validator-new-node.yaml

# Проверка
kubectl get pods -n canton-node -l node=new-validator
```

## 🔧 Решение проблемы "Download failed"

Если при установке k3s возникает ошибка "Download failed":

1. **Проверьте доступность GitHub:**
   ```bash
   curl -I https://github.com
   ```

2. **Используйте конкретную версию вместо latest:**
   ```bash
   K3S_VERSION="v1.31.5+k3s1"
   curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - agent ...
   ```

3. **Или скачайте бинарник вручную:**
   ```bash
   wget https://github.com/k3s-io/k3s/releases/download/v1.31.5%2Bk3s1/k3s
   chmod +x k3s
   mv k3s /usr/local/bin/
   ```

---

**Токен для подключения:**
```
K1087801d7ba6fbe302c62738be2891ae7c953367e423a3e0c5fa1fa61d1f8f6419::server:a30f8f09d77232f9da92b48b94f27f15
```

















