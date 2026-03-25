# Проверка валидации IP для Testnet и Mainnet

## 📋 Текущий статус

- **Testnet IP**: 65.108.15.20
- **Mainnet IP**: 65.108.15.19
- **Статус нод**: Не подключены к k3s кластеру (требуется подключение)

---

## 🚀 Вариант 1: Проверка через SSH (если ноды доступны)

### Testnet (65.108.15.20)

```bash
# 1. Подключитесь к серверу
ssh root@65.108.15.20

# 2. Скачайте и запустите скрипт проверки
curl -sSL https://raw.githubusercontent.com/your-repo/canton-otc/main/blockchain/scripts/validate-testnet-ip.sh | bash

# Или скопируйте скрипт вручную:
# scp blockchain/scripts/validate-testnet-ip.sh root@65.108.15.20:/tmp/
# ssh root@65.108.15.20 "bash /tmp/validate-testnet-ip.sh"
```

### Mainnet (65.108.15.19)

```bash
# 1. Подключитесь к серверу
ssh root@65.108.15.19

# 2. Скачайте и запустите скрипт проверки
curl -sSL https://raw.githubusercontent.com/your-repo/canton-otc/main/blockchain/scripts/validate-mainnet-ip.sh | bash

# Или скопируйте скрипт вручную:
# scp blockchain/scripts/validate-mainnet-ip.sh root@65.108.15.19:/tmp/
# ssh root@65.108.15.19 "bash /tmp/validate-mainnet-ip.sh"
```

---

## 🚀 Вариант 2: Проверка через kubectl Job (если ноды подключены к кластеру)

### Шаг 1: Подключение нод к кластеру

#### Testnet (65.108.15.20)

```bash
# 1. Получите токен k3s на master ноде
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 2. На сервере 65.108.15.20 выполните:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME="canton-node-65-108-15-20"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# 3. Проверка подключения
kubectl get nodes -o wide | grep 65.108.15.20
```

#### Mainnet (65.108.15.19)

```bash
# 1. Получите токен k3s на master ноде
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# 2. На сервере 65.108.15.19 выполните:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.19"
NODE_NAME="canton-node-65-108-15-19"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН_СЮДА>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}

# 3. Проверка подключения
kubectl get nodes -o wide | grep 65.108.15.19
```

### Шаг 2: Запуск проверки через kubectl

#### Testnet

```bash
# Удалите предыдущий Job (если есть)
kubectl delete job ip-validation-checker -n default --ignore-not-found=true

# Запустите проверку
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml

# Смотрите результаты в реальном времени
kubectl logs -l job-name=ip-validation-checker -f

# Просмотреть полный отчет
kubectl logs -l job-name=ip-validation-checker --tail=200
```

#### Mainnet

```bash
# Удалите предыдущий Job (если есть)
kubectl delete job ip-validation-checker -n default --ignore-not-found=true

# Запустите проверку
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml

# Смотрите результаты в реальном времени
kubectl logs -l job-name=ip-validation-checker -f

# Просмотреть полный отчет
kubectl logs -l job-name=ip-validation-checker --tail=200
```

---

## 🔍 Интерпретация результатов

### ✅ Успешная валидация

```
✅ IP-адрес валидирован для Testnet/Mainnet!
   X из Y SV добавили IP (Z%)
   Требование 2/3 выполнено
```

**Требования:**
- Минимум **66.7%** (2/3) Super Validators должны добавить IP в allowlist
- Все Sequencer endpoints должны быть доступны

### ⏳ Частичная валидация

```
⏳ IP-адрес частично валидирован
   X из Y SV добавили IP (Z%)
   Ожидайте 2-7 дней, пока остальные SV обновят allowlist
```

**Действия:**
- Подождите 2-7 дней
- Свяжитесь с SV sponsor для уточнения статуса
- Повторите проверку позже

### ❌ Валидация не пройдена

```
❌ IP-адрес НЕ валидирован
   Не удалось подключиться к Super Validators
```

**Проверьте:**
1. IP адрес правильный (65.108.15.20 для Testnet, 65.108.15.19 для Mainnet)
2. Сетевое подключение работает
3. SV sponsor добавил IP в whitelist
4. Для Mainnet: получен MainNet allocation

---

## 📊 Текущий статус валидации

| Сеть | IP | Статус ноды | Статус валидации | Действие |
|------|-----|-------------|------------------|----------|
| Devnet | 65.108.15.30 | ✅ Подключена | ✅ Валидирован (14/15 SV) | Готово к развертыванию |
| Testnet | 65.108.15.20 | ❌ Не подключена | ⏳ Требуется проверка | Подключить ноду → Запустить проверку |
| Mainnet | 65.108.15.19 | ❌ Не подключена | ⏳ Требуется проверка | Подключить ноду → Запустить проверку |

---

## 🔧 Troubleshooting

### Проблема: Нода не подключается к кластеру

```bash
# Проверьте доступность master ноды
ping 31.129.105.180

# Проверьте порт 6443
telnet 31.129.105.180 6443

# Проверьте токен
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"
```

### Проблема: Job не запускается

```bash
# Проверьте статус ноды
kubectl get nodes -o wide

# Проверьте hostname ноды
kubectl get nodes -o jsonpath='{.items[*].metadata.name}'

# Обновите nodeSelector в манифесте
# Отредактируйте blockchain/k8s/ip-validation-testnet.yaml
# или blockchain/k8s/ip-validation-mainnet.yaml
```

### Проблема: Все тесты показывают TIMEOUT

1. **Проверьте whitelisting**: Свяжитесь с SV sponsor
2. **Проверьте сеть**: Убедитесь, что исходящие HTTPS соединения разрешены
3. **Проверьте DNS**: `nslookup scan.sv-1.testnet.global.canton.network.sync.global`
4. **Для Mainnet**: Убедитесь, что получен MainNet allocation

---

## 📞 Контакты для поддержки

- **SV Sponsor**: Свяжитесь для уточнения статуса whitelisting
- **Slack**: #validator-operations
- **Время ожидания**: Обычно 2-7 дней для обновления allowlist

---

## 📝 Следующие шаги после валидации

### После успешной валидации Testnet:

1. Получите Testnet onboarding secret
2. Разверните Testnet валидатор
3. Проверьте подключение к сети

### После успешной валидации Mainnet:

1. Убедитесь, что получен MainNet allocation
2. Получите Mainnet onboarding secret от SV sponsor
3. Разверните Mainnet валидатор
4. Проверьте подключение к сети

---

**Последнее обновление**: $(date +"%Y-%m-%d")





