# 🚀 Развертывание Canton Testnet Validator на 65.108.15.20

## 📋 Текущий статус

- **IP ноды**: 65.108.15.20
- **Сеть**: Testnet
- **Whitelisting**: Запрос отправлен (Sponsor: GSF, Organization: TECH HY)
- **Статус ноды**: НЕ подключена к k3s кластеру

## ✅ Шаг 1: Подключение ноды к кластеру

**Выполните на сервере 65.108.15.20:**

```bash
# 1. Подключитесь к серверу
ssh root@65.108.15.20

# 2. Получите токен k3s на master ноде:
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 3. На сервере 65.108.15.20 выполните:

MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME=$(hostname)
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

# Подключение к кластеру
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# Проверка подключения
sleep 5
sudo k3s kubectl get nodes
echo "Hostname ноды: $NODE_NAME"
```

**Сохраните hostname ноды** для следующего шага!

## ✅ Шаг 2: Обновление манифеста

**На локальной машине с kubectl:**

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 1. Проверьте, что нода подключена
kubectl get nodes -o wide
# Найдите ноду с IP 65.108.15.20 и запомните её NAME

# 2. Обновите hostname в манифесте
cd blockchain/scripts
./update-node-hostname.sh <HOSTNAME_НОДЫ> testnet

# Или вручную отредактируйте:
# config/kubernetes/k8s/canton-validator-testnet.yaml
# Замените: kubernetes.io/hostname: ""
# На: kubernetes.io/hostname: "<HOSTNAME_НОДЫ>"
```

## ✅ Шаг 3: Получение Testnet Onboarding Secret

**ВАЖНО**: Onboarding secret можно получить только после whitelisting IP.

```bash
cd blockchain/scripts

# Попробуйте получить secret (может не работать до whitelisting)
./get-onboarding-secret.sh testnet --save

# Если не работает, свяжитесь с SV sponsor для получения secret
```

## ✅ Шаг 4: Создание/обновление Secret

```bash
# Если получили secret через API
kubectl create secret generic canton-onboarding-testnet \
    -n canton-node \
    --from-literal=ONBOARDING_SECRET="<ВАШ_SECRET>" \
    --dry-run=client -o yaml | kubectl apply -f -

# Или если получили через скрипт, он должен был сохранить в файл
# Проверьте: blockchain/config/onboarding-secrets.env
```

## ✅ Шаг 5: Развертывание валидатора

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# Развертывание
kubectl apply -f config/kubernetes/k8s/canton-validator-testnet.yaml

# Проверка статуса
kubectl get pods -n canton-node -l node=testnet-validator -w
```

## ✅ Шаг 6: Проверка работы и whitelisting

```bash
# Health check
curl http://65.108.15.20:8081/health

# Логи
kubectl logs -f -n canton-node -l node=testnet-validator

# Проверка на ошибки whitelisting
kubectl logs -n canton-node -l node=testnet-validator | grep -i "whitelist\|unauthorized\|forbidden\|403\|401"

# Статус пода
kubectl get pods -n canton-node -l node=testnet-validator
kubectl describe pod -n canton-node -l node=testnet-validator
```

## 🔍 Проверка whitelisting

Whitelisting можно проверить по логам валидатора:

**Признаки успешного whitelisting:**
- ✅ Логи показывают успешное подключение к Testnet
- ✅ Health endpoint отвечает
- ✅ Нет ошибок "unauthorized", "forbidden", "not whitelisted"

**Признаки проблем с whitelisting:**
- ❌ Ошибки "IP not whitelisted"
- ❌ Ошибки "403 Forbidden" или "401 Unauthorized"
- ❌ Невозможность подключиться к Testnet API

## 📝 Важные замечания

1. **Whitelisting**: IP 65.108.15.20 должен быть добавлен в whitelist для Testnet
2. **Onboarding Secret**: Можно получить только после whitelisting
3. **Порты**: Убедитесь, что порты 8080, 8081, 8082, 6865 открыты в firewall
4. **Sponsor**: GSF, Organization: TECH HY

## 🚀 Автоматическое развертывание

После подключения ноды к кластеру можно использовать автоматический скрипт:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./blockchain/scripts/deploy-testnet-validator.sh
```

---

**Дата создания**: 2025-01-27  
**Статус**: Готово к развертыванию после подключения ноды ✅


















