# 📊 Статус проверки валидации IP адресов

**Дата проверки**: $(date +"%Y-%m-%d %H:%M:%S")

---

## ✅ Готовые инструменты

### Скрипты проверки
- ✅ `blockchain/scripts/validate-testnet-ip.sh` - проверка Testnet (65.108.15.20)
- ✅ `blockchain/scripts/validate-mainnet-ip.sh` - проверка Mainnet (65.108.15.19)
- ✅ `blockchain/scripts/run-all-ip-validation.sh` - универсальный скрипт запуска

### Kubernetes манифесты
- ✅ `blockchain/k8s/ip-validation-testnet.yaml` - Job для Testnet
- ✅ `blockchain/k8s/ip-validation-mainnet.yaml` - Job для Mainnet

### Документация
- ✅ `blockchain/VALIDATE_TESTNET_MAINNET_IPS.md` - полная инструкция
- ✅ `blockchain/QUICK_VALIDATE_TESTNET_MAINNET.md` - краткая инструкция

---

## 📋 Текущий статус

| Сеть | IP | Статус ноды | Статус валидации | Способ проверки |
|------|-----|-------------|------------------|-----------------|
| **Devnet** | 65.108.15.30 | ✅ Подключена | ✅ Валидирован (14/15 SV) | ✅ Выполнено |
| **Testnet** | 65.108.15.20 | ❌ Не подключена | ⏳ Требуется проверка | SSH или подключить ноду |
| **Mainnet** | 65.108.15.19 | ❌ Не подключена | ⏳ Требуется проверка | SSH или подключить ноду |

---

## 🚀 Как запустить проверку

### Вариант 1: Через SSH (если серверы доступны)

```bash
# Testnet
scp blockchain/scripts/validate-testnet-ip.sh root@65.108.15.20:/tmp/ && \
ssh root@65.108.15.20 "bash /tmp/validate-testnet-ip.sh"

# Mainnet
scp blockchain/scripts/validate-mainnet-ip.sh root@65.108.15.19:/tmp/ && \
ssh root@65.108.15.19 "bash /tmp/validate-mainnet-ip.sh"
```

### Вариант 2: Подключить ноды к кластеру, затем через kubectl

#### Шаг 1: Подключение нод

**Testnet (65.108.15.20):**
```bash
# На master ноде получите токен
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# На сервере 65.108.15.20:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.20"
NODE_NAME="canton-node-65-108-15-20"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}
```

**Mainnet (65.108.15.19):**
```bash
# На master ноде получите токен
ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"

# На сервере 65.108.15.19:
MASTER_IP="31.129.105.180"
NODE_IP="65.108.15.19"
NODE_NAME="canton-node-65-108-15-19"
K3S_TOKEN="<ВСТАВЬТЕ_ТОКЕН>"

curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \
    --server https://${MASTER_IP}:6443 \
    --token ${K3S_TOKEN} \
    --node-name ${NODE_NAME} \
    --node-ip ${NODE_IP}
```

#### Шаг 2: Запуск проверки через kubectl

```bash
# Testnet
kubectl delete job ip-validation-checker-testnet -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
kubectl logs -l job-name=ip-validation-checker-testnet -f

# Mainnet
kubectl delete job ip-validation-checker-mainnet -n default --ignore-not-found=true
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
kubectl logs -l job-name=ip-validation-checker-mainnet -f
```

### Вариант 3: Универсальный скрипт

```bash
# Автоматически попробует kubectl, затем SSH
bash blockchain/scripts/run-all-ip-validation.sh
```

---

## 🔍 Что проверяют скрипты

1. **Подтверждение IP-адреса**
   - Testnet: должен быть 65.108.15.20
   - Mainnet: должен быть 65.108.15.19

2. **Подключение к Scan API**
   - Проверка доступности всех Super Validators
   - Получение версий для каждого SV

3. **Проверка Sequencer endpoints**
   - Доступность всех Sequencer endpoints
   - Подсчет успешных подключений

4. **Расчет процента успеха**
   - Требуется минимум **66.7%** (2/3) SV
   - Отображение статистики

---

## ✅ Критерии успешной валидации

- ✅ Минимум **66.7%** (2/3) Super Validators добавили IP в allowlist
- ✅ Все Sequencer endpoints доступны
- ✅ Нет критических ошибок подключения

---

## 📊 Интерпретация результатов

### ✅ Успешная валидация
```
✅ IP-адрес валидирован для Testnet/Mainnet!
   X из Y SV добавили IP (Z%)
   Требование 2/3 выполнено
```
**Действие**: Можно развертывать валидатор

### ⏳ Частичная валидация
```
⏳ IP-адрес частично валидирован
   X из Y SV добавили IP (Z%)
   Ожидайте 2-7 дней, пока остальные SV обновят allowlist
```
**Действие**: Подождите 2-7 дней, затем повторите проверку

### ❌ Валидация не пройдена
```
❌ IP-адрес НЕ валидирован
   Не удалось подключиться к Super Validators
```
**Действие**: 
- Проверьте whitelisting у SV sponsor
- Убедитесь, что IP правильный
- Для Mainnet: проверьте наличие allocation

---

## 🔧 Troubleshooting

### Проблема: Не удается подключиться через SSH

**Решения:**
1. Проверьте доступность сервера: `ping 65.108.15.20` или `ping 65.108.15.19`
2. Проверьте SSH ключи: `ssh-add -l`
3. Попробуйте подключиться вручную: `ssh root@65.108.15.20`
4. Используйте вариант с подключением ноды к кластеру

### Проблема: Нода не подключается к кластеру

**Решения:**
1. Проверьте доступность master ноды: `ping 31.129.105.180`
2. Проверьте порт 6443: `telnet 31.129.105.180 6443`
3. Проверьте токен: `ssh root@31.129.105.180 "sudo cat /var/lib/rancher/k3s/server/node-token"`
4. Проверьте firewall правила

### Проблема: Все тесты показывают TIMEOUT

**Решения:**
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

## 📝 Следующие шаги

### После успешной валидации Testnet:
1. ✅ Получите Testnet onboarding secret
2. ✅ Разверните Testnet валидатор
3. ✅ Проверьте подключение к сети

### После успешной валидации Mainnet:
1. ✅ Убедитесь, что получен MainNet allocation
2. ✅ Получите Mainnet onboarding secret от SV sponsor
3. ✅ Разверните Mainnet валидатор
4. ✅ Проверьте подключение к сети

---

**Последнее обновление**: $(date +"%Y-%m-%d %H:%M:%S")





