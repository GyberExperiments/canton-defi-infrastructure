# ⚡ Быстрое подключение статических IP к кластеру

## 📋 Ситуация

У вас есть статические IP адреса:
- **Devnet**: 65.108.15.30 ✅ (уже подключен как `canton-node-65-108-15-30`)
- **Testnet**: 65.108.15.20 ⏳ (нужно подключить)
- **Mainnet**: 65.108.15.19 ⏳ (нужно подключить)

---

## 🎯 Два варианта решения

### Вариант 1: IP на одном сервере (рекомендуется)

Если все IP адреса находятся на одном сервере (65.108.15.30):

```bash
# 1. Подключитесь к серверу
ssh root@65.108.15.30

# 2. Запустите скрипт настройки
cd /path/to/canton-otc
bash blockchain/scripts/setup-multiple-ips-on-node.sh

# 3. Отредактируйте netplan для постоянного сохранения
nano /etc/netplan/50-cloud-init.yaml
# Добавьте IP адреса 65.108.15.20 и 65.108.15.19

# 4. Примените изменения
netplan apply

# 5. Перезапустите k3s agent
systemctl restart k3s-agent

# 6. Проверьте в кластере
kubectl get nodes -o wide
```

**После этого** манифесты проверки IP будут работать, так как они используют `hostNetwork: true` и `nodeSelector` на ноду `canton-node-65-108-15-30`.

**Но для правильной маршрутизации трафика** с нужного IP используйте iptables (скрипт настроит автоматически).

---

### Вариант 2: IP на разных серверах

Если IP адреса находятся на разных серверах:

#### Testnet (65.108.15.20)

```bash
# 1. Получите токен на master ноде
K3S_TOKEN=$(ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token")

# 2. На сервере 65.108.15.20:
ssh root@65.108.15.20

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME="canton-node-65-108-15-20"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}
```

#### Mainnet (65.108.15.19)

```bash
# 1. Используйте тот же токен
K3S_TOKEN=$(ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token")

# 2. На сервере 65.108.15.19:
ssh root@65.108.15.19

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.19"
NODE_NAME="canton-node-65-108-15-19"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}
```

---

## ✅ Проверка после настройки

```bash
# Проверьте ноды в кластере
kubectl get nodes -o wide

# Должны увидеть:
# canton-node-65-108-15-30  Ready  65.108.15.30
# canton-node-65-108-15-20  Ready  65.108.15.20  (если отдельный сервер)
# canton-node-65-108-15-19  Ready  65.108.15.19  (если отдельный сервер)
```

---

## 🚀 Запуск проверки валидации

После подключения IP адресов:

```bash
# Testnet
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Mainnet
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker-mainnet -f
```

---

## 📖 Подробная инструкция

См. `blockchain/CONNECT_STATIC_IPS_TO_CLUSTER.md` для детальной информации.





