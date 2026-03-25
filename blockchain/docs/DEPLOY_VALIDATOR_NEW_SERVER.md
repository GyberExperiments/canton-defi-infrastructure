# 🚀 Развертывание Canton Validator на новом сервере

Полное руководство по подключению нового сервера к k3s кластеру и развертыванию Canton Validator.

## 📋 Информация о сервере

- **IPv4 Address**: `65.108.15.30`
- **IPv6 Address**: `2a01:4f9:6a:4ad6::2`
- **Username**: `root`
- **Password**: `$CANTON_PASSWORD`

**Host keys** (для проверки при SSH подключении):
- ECDSA 256: `am8E1IpDVmsF9Kahi3erZTIBuWfE2XcaZDHsLHy32Vc`
- ED25519 256: `iRxicZZdxolkQ2KIkv/U2GUvQLMg8a5172mrqHzkXtY`
- RSA 3072: `XZmu8SOK1f9zQzAKdk7xXhK44pvHE39L3W43Qo+PpbE`

## 🎯 Быстрый старт

### Вариант 1: Полное автоматическое развертывание (рекомендуется)

```bash
# 1. Подключитесь к новому серверу
ssh root@65.108.15.30

# 2. Клонируйте репозиторий (или скопируйте файлы)
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git
cd CantonOTC/blockchain

# 3. Получите токен для подключения к k3s кластеру на master ноде:
# На master ноде выполните:
sudo cat /var/lib/rancher/k3s/server/node-token

# 4. Запустите полное развертывание
./scripts/deploy-canton-validator.sh \
  --master-ip <MASTER_IP> \
  --token <K3S_TOKEN> \
  --network devnet
```

### Вариант 2: Пошаговое развертывание

```bash
# Шаг 1: Подключение к k3s кластеру
./scripts/join-k3s-cluster.sh \
  --master-ip <MASTER_IP> \
  --token <K3S_TOKEN> \
  --node-ip 65.108.15.30

# Шаг 2: Получение onboarding secret
./scripts/get-onboarding-secret.sh devnet --save

# Шаг 3: Развертывание валидатора (с локальной машины с kubectl)
cd ../../config/kubernetes/k8s
kubectl apply -f canton-namespace.yaml
kubectl create secret generic canton-onboarding \
  --namespace=canton-node \
  --from-literal=ONBOARDING_SECRET="<полученный_secret>"
kubectl apply -f canton-validator-new-node.yaml
```

## 📝 Детальная инструкция

### 1. Подготовка сервера

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка базовых инструментов
apt-get install -y curl wget git vim

# Проверка открытых портов (важно для валидатора)
# Порты, которые должны быть открыты:
# - 8080 (Metrics)
# - 8081 (Health)
# - 8082 (Admin API)
# - 6865 (Ledger API gRPC)

# Проверка firewall
ufw status
# Если firewall включен, откройте порты:
ufw allow 8080/tcp
ufw allow 8081/tcp
ufw allow 8082/tcp
ufw allow 6865/tcp
```

### 2. Подключение к k3s кластеру

#### 2.1. Получение токена на master ноде

На master ноде k3s кластера выполните:

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

Скопируйте полученный токен.

#### 2.2. Определение IP master ноды

Узнайте IP адрес master ноды k3s кластера. Это может быть:
- Внутренний IP адрес в локальной сети
- Публичный IP адрес (если master нода имеет публичный IP)

#### 2.3. Запуск подключения

На новом сервере (65.108.15.30):

```bash
cd /root/CantonOTC/blockchain

./scripts/join-k3s-cluster.sh \
  --master-ip <MASTER_IP> \
  --token <K3S_TOKEN> \
  --node-name canton-validator-2 \
  --node-ip 65.108.15.30
```

Скрипт автоматически:
- Установит k3s agent
- Подключит ноду к кластеру
- Настроит сетевые параметры

**Проверка подключения:**

```bash
# На master ноде или с настроенным kubectl:
kubectl get nodes

# Должна появиться новая нода с именем, указанным в --node-name
```

### 3. Получение onboarding secret

Onboarding secret необходим для подключения валидатора к Canton Network.

```bash
cd /root/CantonOTC/blockchain

# Получение secret для DevNet
./scripts/get-onboarding-secret.sh devnet --save

# Secret будет сохранен в config/onboarding-secrets.env
```

**Важно:**
- DevNet secret действителен только 1 час
- Получите secret непосредственно перед развертыванием

### 4. Развертывание Canton Validator

#### 4.1. Создание namespace и секретов

С локальной машины (где настроен kubectl и доступ к кластеру):

```bash
cd /path/to/canton-otc/config/kubernetes/k8s

# Создание namespace
kubectl apply -f canton-namespace.yaml

# Создание ConfigMap с конфигурацией
kubectl create configmap canton-config \
  --namespace=canton-node \
  --from-file=../../blockchain/config/canton.conf \
  --from-file=../../blockchain/config/validator.conf \
  --dry-run=client -o yaml | kubectl apply -f -

# Создание Secret с onboarding secret
# Замените <ONBOARDING_SECRET> на реальный secret
kubectl create secret generic canton-onboarding \
  --namespace=canton-node \
  --from-literal=ONBOARDING_SECRET="<ONBOARDING_SECRET>" \
  --dry-run=client -o yaml | kubectl apply -f -

# Создание Secret для GHCR (если образ приватный)
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=<GITHUB_USERNAME> \
  --docker-password=<GITHUB_TOKEN> \
  --namespace=canton-node \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### 4.2. Определение hostname новой ноды

```bash
# Получите hostname новой ноды
kubectl get nodes

# Найдите новую ноду и запомните её имя (столбец NAME)
```

#### 4.3. Обновление манифеста с правильным hostname

Отредактируйте `canton-validator-new-node.yaml`:

```yaml
nodeSelector:
  kubernetes.io/hostname: "<HOSTNAME_НОВОЙ_НОДЫ>"
```

#### 4.4. Развертывание StatefulSet

```bash
kubectl apply -f canton-validator-new-node.yaml
```

#### 4.5. Проверка развертывания

```bash
# Проверка статуса пода
kubectl get pods -n canton-node -l app=canton-node,node=new-validator

# Просмотр логов
kubectl logs -f -n canton-node -l app=canton-node,node=new-validator

# Описание пода (для диагностики)
kubectl describe pod -n canton-node -l app=canton-node,node=new-validator
```

### 5. Проверка работы валидатора

#### 5.1. Health check

```bash
# С любого места с доступом к серверу
curl http://65.108.15.30:8081/health

# Ожидаемый ответ: {"status":"healthy"} или аналогичный
```

#### 5.2. Metrics endpoint

```bash
curl http://65.108.15.30:8080/metrics
```

#### 5.3. Проверка подключения к Canton Network

Проверьте логи валидатора на предмет успешного подключения к Canton Network:

```bash
kubectl logs -n canton-node -l app=canton-node,node=new-validator | grep -i "connected\|onboarded\|error"
```

## 🔧 Настройка firewall

Убедитесь, что следующие порты открыты на новом сервере:

```bash
# UFW (если используется)
ufw allow 8080/tcp comment "Canton Metrics"
ufw allow 8081/tcp comment "Canton Health"
ufw allow 8082/tcp comment "Canton Admin"
ufw allow 6865/tcp comment "Canton Ledger API"

# Или iptables напрямую
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
iptables -A INPUT -p tcp --dport 8081 -j ACCEPT
iptables -A INPUT -p tcp --dport 8082 -j ACCEPT
iptables -A INPUT -p tcp --dport 6865 -j ACCEPT
```

## 🔐 Whitelisting IP в Canton Network

**ВАЖНО:** Сообщите вашему SV sponsor Canton Network IP адрес `65.108.15.30` для whitelisting на DevNet/TestNet/MainNet.

Процесс whitelisting:
1. Свяжитесь с SV sponsor Canton Network
2. Предоставьте IP адрес: `65.108.15.30`
3. Укажите, для какой сети нужен whitelisting (DevNet/TestNet/MainNet)
4. Дождитесь подтверждения whitelisting
5. Перезапустите валидатор после whitelisting

## 🐛 Устранение проблем

### Проблема: Нода не подключается к k3s

**Решение:**
```bash
# Проверьте связность с master нодой
ping <MASTER_IP>

# Проверьте доступность порта 6443
telnet <MASTER_IP> 6443

# Проверьте логи k3s agent
sudo journalctl -u k3s-agent -f
```

### Проблема: Pod не запускается

**Решение:**
```bash
# Проверьте описание пода
kubectl describe pod -n canton-node -l app=canton-node,node=new-validator

# Проверьте события
kubectl get events -n canton-node --sort-by='.lastTimestamp'

# Проверьте логи пода
kubectl logs -n canton-node -l app=canton-node,node=new-validator
```

### Проблема: ImagePullBackOff

**Решение:**
```bash
# Проверьте, что Secret для GHCR создан
kubectl get secret ghcr-creds -n canton-node

# Если отсутствует, создайте его:
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username=<USERNAME> \
  --docker-password=<TOKEN> \
  --namespace=canton-node
```

### Проблема: Health check не проходит

**Решение:**
```bash
# Проверьте, что порт открыт
netstat -tulpn | grep 8081

# Проверьте логи валидатора
kubectl logs -n canton-node -l app=canton-node,node=new-validator --tail=50

# Проверьте, что валидатор запустился
kubectl exec -n canton-node -l app=canton-node,node=new-validator -- ps aux | grep canton
```

### Проблема: Валидатор не подключается к Canton Network

**Решение:**
```bash
# Проверьте onboarding secret
kubectl get secret canton-onboarding -n canton-node -o jsonpath='{.data.ONBOARDING_SECRET}' | base64 -d
echo ""

# Проверьте, что IP добавлен в whitelist
# Свяжитесь с SV sponsor для проверки whitelisting

# Проверьте сетевую связность с Canton API
curl -I https://sv.sv-1.dev.global.canton.network.sync.global
```

## 📊 Мониторинг

### Endpoints валидатора

- **Health**: `http://65.108.15.30:8081/health`
- **Metrics**: `http://65.108.15.30:8080/metrics`
- **Admin API**: `http://65.108.15.30:8082/admin`
- **Ledger API**: `grpc://65.108.15.30:6865`

### Команды для мониторинга

```bash
# Статус пода
kubectl get pods -n canton-node -l app=canton-node,node=new-validator -w

# Использование ресурсов
kubectl top pod -n canton-node -l app=canton-node,node=new-validator

# Логи в реальном времени
kubectl logs -f -n canton-node -l app=canton-node,node=new-validator

# Проверка health каждые 5 секунд
watch -n 5 'curl -s http://65.108.15.30:8081/health'
```

## 🔄 Обновление валидатора

```bash
# Обновление образа
kubectl set image statefulset/canton-node-new \
  canton-validator=ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  -n canton-node

# Перезапуск StatefulSet
kubectl rollout restart statefulset/canton-node-new -n canton-node

# Проверка статуса
kubectl rollout status statefulset/canton-node-new -n canton-node
```

## 📚 Дополнительная документация

- [Canton Validator Setup Guide](../docs/CANTON_VALIDATOR_SETUP.md)
- [Официальная документация Canton](https://sync.global/docs/)
- [K3s документация](https://docs.k3s.io/)

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи валидатора
2. Проверьте события Kubernetes
3. Проверьте документацию по устранению проблем выше
4. Обратитесь к SV sponsor Canton Network

---

**Дата создания**: $(date +%Y-%m-%d)  
**Версия**: 1.0  
**Статус**: Production Ready ✅

