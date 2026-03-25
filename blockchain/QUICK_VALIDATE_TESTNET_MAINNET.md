# ⚡ Быстрая проверка Testnet и Mainnet IP

## 🎯 Цель
Проверить whitelisting и валидацию IP адресов:
- **Testnet**: 65.108.15.20
- **Mainnet**: 65.108.15.19

---

## 🚀 Быстрый запуск

### Вариант A: Через SSH (рекомендуется, если ноды не в кластере)

```bash
# Testnet
scp blockchain/scripts/validate-testnet-ip.sh root@65.108.15.20:/tmp/ && \
ssh root@65.108.15.20 "bash /tmp/validate-testnet-ip.sh"

# Mainnet  
scp blockchain/scripts/validate-mainnet-ip.sh root@65.108.15.19:/tmp/ && \
ssh root@65.108.15.19 "bash /tmp/validate-mainnet-ip.sh"
```

### Вариант B: Через kubectl Job (если ноды подключены)

```bash
# 1. Проверьте подключение нод
kubectl get nodes -o wide | grep -E "65.108.15.(19|20)"

# 2. Testnet
kubectl delete job ip-validation-checker -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker -f

# 3. Mainnet
kubectl delete job ip-validation-checker -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker -f
```

---

## ✅ Критерии успешной валидации

- **Минимум 66.7%** (2/3) Super Validators добавили IP в allowlist
- Все Sequencer endpoints доступны
- Нет ошибок подключения к Scan API

---

## 📊 Ожидаемые результаты

### ✅ Успех
```
✅ IP-адрес валидирован!
   X из Y SV добавили IP (Z%)
   Требование 2/3 выполнено
```

### ⏳ Частичный успех
```
⏳ IP-адрес частично валидирован
   Ожидайте 2-7 дней для обновления allowlist
```

### ❌ Неудача
```
❌ IP-адрес НЕ валидирован
   Проверьте whitelisting у SV sponsor
```

---

## 🔗 Дополнительная информация

- Полная инструкция: `blockchain/VALIDATE_TESTNET_MAINNET_IPS.md`
- Скрипты: `blockchain/scripts/validate-{testnet,mainnet}-ip.sh`
- K8s манифесты: `blockchain/k8s/ip-validation-{testnet,mainnet}.yaml`





