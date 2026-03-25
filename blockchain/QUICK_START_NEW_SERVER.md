# ⚡ Быстрый старт: Развертывание Canton Validator на новом сервере

## 📋 Информация о сервере

- **IP**: `65.108.15.30`
- **User**: `root`
- **Password**: `$CANTON_PASSWORD`

## 🚀 Команды для развертывания

### Шаг 1: Подключение к серверу

```bash
ssh root@65.108.15.30
```

При первом подключении проверьте host keys:
- ECDSA: `am8E1IpDVmsF9Kahi3erZTIBuWfE2XcaZDHsLHy32Vc`
- ED25519: `iRxicZZdxolkQ2KIkv/U2GUvQLMg8a5172mrqHzkXtY`
- RSA: `XZmu8SOK1f9zQzAKdk7xXhK44pvHE39L3W43Qo+PpbE`

### Шаг 2: Подготовка сервера

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка базовых инструментов
apt-get install -y curl wget git

# Клонирование репозитория (или загрузка файлов)
git clone https://github.com/TheMacroeconomicDao/CantonOTC.git
cd CantonOTC/blockchain

# Установка прав на выполнение
chmod +x scripts/*.sh
```

### Шаг 3: Получение токена k3s

**На master ноде k3s кластера выполните:**

```bash
sudo cat /var/lib/rancher/k3s/server/node-token
```

Скопируйте токен.

**Узнайте IP адрес master ноды** (замените `<MASTER_IP>` на реальный IP)

### Шаг 4: Полное развертывание

```bash
# На новом сервере (65.108.15.30):
cd /root/CantonOTC/blockchain

./scripts/deploy-canton-validator.sh \
  --master-ip <MASTER_IP> \
  --token <K3S_TOKEN> \
  --node-ip 65.108.15.30 \
  --network devnet
```

Скрипт автоматически:
1. ✅ Подключит сервер к k3s кластеру
2. ✅ Получит onboarding secret для DevNet
3. ✅ Создаст все необходимые ресурсы в Kubernetes
4. ✅ Развернет Canton Validator

### Шаг 5: Проверка

```bash
# Проверка health endpoint
curl http://65.108.15.30:8081/health

# Проверка статуса пода (с машины с kubectl)
kubectl get pods -n canton-node -l app=canton-node,node=new-validator

# Просмотр логов
kubectl logs -f -n canton-node -l app=canton-node,node=new-validator
```

## 🔐 Важные действия после развертывания

### 1. Whitelisting IP в Canton Network

**КРИТИЧНО:** Сообщите вашему SV sponsor Canton Network IP адрес `65.108.15.30` для whitelisting.

### 2. Проверка открытых портов

Убедитесь, что порты открыты в firewall:

```bash
ufw allow 8080/tcp  # Metrics
ufw allow 8081/tcp  # Health
ufw allow 8082/tcp  # Admin
ufw allow 6865/tcp  # Ledger API
```

### 3. Мониторинг

```bash
# Endpoints для проверки:
# Health: http://65.108.15.30:8081/health
# Metrics: http://65.108.15.30:8080/metrics
# Admin: http://65.108.15.30:8082/admin
```

## 📚 Полная документация

Подробная инструкция: [`docs/DEPLOY_VALIDATOR_NEW_SERVER.md`](docs/DEPLOY_VALIDATOR_NEW_SERVER.md)

## 🆘 Проблемы?

1. **Нода не подключается**: Проверьте токен и IP master ноды
2. **Pod не запускается**: Проверьте логи `kubectl logs -n canton-node ...`
3. **Health check не работает**: Убедитесь, что порты открыты

Подробнее см. раздел "Устранение проблем" в полной документации.

