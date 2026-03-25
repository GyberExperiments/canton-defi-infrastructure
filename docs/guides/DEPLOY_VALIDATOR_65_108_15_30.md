# 🚀 Развертывание Canton Validator на сервере 65.108.15.30

## ✅ Подготовка завершена

Все ресурсы Kubernetes подготовлены:
- ✅ ConfigMap `canton-config` обновлен
- ✅ Secret `canton-onboarding` существует
- ✅ Secret `ghcr-creds` существует
- ✅ Namespace `canton-node` готов

## 📋 Что нужно сделать на сервере

### Вариант 1: Автоматическое подключение (рекомендуется)

**На сервере 65.108.15.30 выполните:**

```bash
# 1. Подключитесь к серверу
ssh root@65.108.15.30

# 2. Получите токен k3s на master ноде (31.129.105.180):
#    Выполните: sudo cat /var/lib/rancher/k3s/server/node-token

# 3. Клонируйте репозиторий
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git
cd CantonOTC/blockchain
chmod +x scripts/*.sh

# 4. Запустите скрипт подключения
export K3S_TOKEN='<полученный_токен>'
./scripts/deploy-on-server.sh
```

### Вариант 2: Ручное подключение

```bash
# На сервере 65.108.15.30:
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
  --server https://31.129.105.180:6443 \
  --token <K3S_TOKEN> \
  --node-name $(hostname) \
  --node-ip 65.108.15.30
```

## 🔧 Развертывание валидатора

После подключения ноды к кластеру, **на машине с kubectl** выполните:

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc

# 1. Получите hostname новой ноды
kubectl get nodes -o wide
# Найдите ноду с IP 65.108.15.30 и запомните её NAME

# 2. Обновите hostname в манифесте
cd blockchain/scripts
./update-node-hostname.sh <HOSTNAME_НОДЫ>

# 3. Разверните валидатора
cd ../../config/kubernetes/k8s
kubectl apply -f canton-validator-new-node.yaml

# 4. Проверьте статус
kubectl get pods -n canton-node -l app=canton-node,node=new-validator -w
```

## ✅ Проверка работы

```bash
# Health check
curl http://65.108.15.30:8081/health

# Логи
kubectl logs -f -n canton-node -l app=canton-node,node=new-validator

# Статус
kubectl get pods -n canton-node -l app=canton-node,node=new-validator
```

## 📝 Важно

1. **Whitelisting**: IP 65.108.15.30 уже заказан для whitelisting ✅
2. **Порты**: Убедитесь, что порты 8080, 8081, 8082, 6865 открыты в firewall
3. **Токен**: Получите токен на master ноде перед подключением

---

**Готово к развертыванию!** 🎯

