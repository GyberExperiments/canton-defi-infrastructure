# ✅ Чеклист развертывания Canton Validator на новом сервере

## 📋 Подготовка

- [ ] Подключение к серверу `65.108.15.30` по SSH
- [ ] Проверка host keys при первом подключении
- [ ] Обновление системы (`apt-get update && apt-get upgrade -y`)
- [ ] Установка базовых инструментов (curl, wget, git)

## 🔗 Подключение к k3s кластеру

- [ ] Получение токена на master ноде:
  ```bash
  sudo cat /var/lib/rancher/k3s/server/node-token
  ```
- [ ] Определение IP адреса master ноды
- [ ] Запуск скрипта подключения:
  ```bash
  ./scripts/join-k3s-cluster.sh \
    --master-ip <MASTER_IP> \
    --token <K3S_TOKEN> \
    --node-ip 65.108.15.30
  ```
- [ ] Проверка подключения: `kubectl get nodes` (на master ноде)

## 🚀 Развертывание валидатора

- [ ] Запуск полного скрипта развертывания:
  ```bash
  ./scripts/deploy-canton-validator.sh \
    --master-ip <MASTER_IP> \
    --token <K3S_TOKEN> \
    --node-ip 65.108.15.30 \
    --network devnet
  ```
- [ ] Проверка создания namespace: `kubectl get namespace canton-node`
- [ ] Проверка создания ConfigMap: `kubectl get configmap canton-config -n canton-node`
- [ ] Проверка создания Secret: `kubectl get secret canton-onboarding -n canton-node`
- [ ] Проверка запуска StatefulSet: `kubectl get statefulset -n canton-node`
- [ ] Проверка запуска Pod: `kubectl get pods -n canton-node`

## 🔐 Whitelisting в Canton Network

- [ ] Связь с SV sponsor Canton Network
- [ ] Предоставление IP адреса: `65.108.15.30`
- [ ] Указание сети (DevNet/TestNet/MainNet)
- [ ] Получение подтверждения whitelisting
- [ ] Перезапуск валидатора после whitelisting

## 🔥 Настройка firewall

- [ ] Открытие порта 8080 (Metrics)
- [ ] Открытие порта 8081 (Health)
- [ ] Открытие порта 8082 (Admin API)
- [ ] Открытие порта 6865 (Ledger API)

## ✅ Проверка работы

- [ ] Health check: `curl http://65.108.15.30:8081/health`
- [ ] Metrics доступны: `curl http://65.108.15.30:8080/metrics`
- [ ] Проверка логов: `kubectl logs -n canton-node -l app=canton-node,node=new-validator`
- [ ] Проверка подключения к Canton Network в логах
- [ ] Отсутствие ошибок в логах

## 📊 Мониторинг

- [ ] Настройка мониторинга health endpoint
- [ ] Настройка алертов на ошибки
- [ ] Проверка использования ресурсов: `kubectl top pod -n canton-node`

## 📚 Документация

- [ ] Прочтение [`QUICK_START_NEW_SERVER.md`](QUICK_START_NEW_SERVER.md)
- [ ] Прочтение [`docs/DEPLOY_VALIDATOR_NEW_SERVER.md`](docs/DEPLOY_VALIDATOR_NEW_SERVER.md)
- [ ] Сохранение учетных данных в безопасном месте

---

**Дата создания**: $(date +%Y-%m-%d)  
**Статус**: Готово к использованию ✅

