## Canton Validator Node Setup Guide (DevNet → TestNet → MainNet)

### Обзор

Полное руководство по поднятию и эксплуатации Validator Node для Canton Network с фиксированным публичным IP на Kubernetes (k3s), с акцентом на DevNet/TestNet/MainNet. В документе описаны whitelisting IP, получение onboarding secret, развертывание на узле с фиксированным IP 45.9.41.209, проверка, безопасность и диагностика.

⚠️ **ВНИМАНИЕ**: Текущий IP 45.9.41.209 географически находится в России (Санкт-Петербург). Рекомендуется уточнить у SV sponsor Canton Network о возможности использования российских IP-адресов, так как могут быть географические ограничения или требования к использованию IP из других стран.

📋 **Нужен сервер с IP из ЕС/США?** См. [Рекомендации по выбору VPS провайдеров](VPS_PROVIDERS_FOR_CANTON_VALIDATOR.md)

Документация Canton: [Sync Global Docs](https://sync.global/docs/)

### Содержание

1. [Архитектура и порты](#архитектура-и-порты)
2. [Предпосылки и инвентаризация](#предпосылки-и-инвентаризация)
3. [DevNet: пошаговый запуск](#devnet-пошаговый-запуск)
4. [TestNet: пошаговый запуск](#testnet-пошаговый-запуск)
5. [MainNet: пошаговый запуск](#mainnet-пошаговый-запуск)
6. [Kubernetes-развертывание (k3s) с фиксированным IP](#kubernetes-развертывание-k3s-с-фиксированным-ip)
7. [Секреты и конфигурация](#секреты-и-конфигурация)
8. [Верификация и мониторинг](#верификация-и-мониторинг)
9. [Траблшутинг](#траблшутинг)
10. [Безопасность и эксплуатация](#безопасность-и-эксплуатация)
11. [Приложение: полезные команды](#приложение-полезные-команды)

### Архитектура и порты

- **Фиксированный IP**: 45.9.41.209 (узел `kczdjomrqi`, Россия, Санкт-Петербург), Kubernetes namespace `canton-node`.
- **Host Networking**: под использует сетевой стек узла, сервис доступен напрямую по публичному IP.
- **Рекомендуемые/используемые порты**:
  - **Ledger API (gRPC)**: 6865 (стандарт де-факто в экосистеме Daml/Canton; проверка доступности: grpc-health-probe).
  - **JSON API (опционально)**: 8080 (если включено в конфигурации JSON API v2).
  - **Health**: 8081.
  - **Admin API**: 8082.

В проектных конфигурациях `blockchain/config/canton.conf` и `validator.conf` уже заданы метрики/health/admin на 8080/8081/8082. При необходимости Ledger API можно вынести на 6865.

### Предпосылки и инвентаризация

- Kubernetes: k3s v1.31.x; узел с публичным IP 45.9.41.209 (`kczdjomrqi`, Россия, Санкт-Петербург).
- Ingress/LB: Traefik с внешними IP. Для Validator выбрана схема без Ingress — прямой доступ по IP через hostNetwork.
- Хранилище: local-path; для узла используем hostPath на ноде для данных/логов.
- Конфиги: `blockchain/config/canton.conf`, `blockchain/config/validator.conf`.
- Контейнерный образ: необходимо указать корректный образ Validator (см. ниже). Плейсхолдеры вида `canton-sync:0.5.8` замените на реальный репозиторий/тег.

### DevNet: пошаговый запуск

1. **Whitelisting IP**
   - Сообщите вашему SV sponsor фиксированный IP `45.9.41.209` (Россия, Санкт-Петербург) для whitelisting на DevNet.
   - ⚠️ **Важно**: Уточните у SV sponsor, разрешены ли российские IP-адреса для валидаторов Canton Network.

2. **Запрос DevNet onboarding secret (API)**
   - Запрос выполняется на DevNet endpoint (см. официальную документацию). Пример (уточните актуальный URL в документации DevNet):
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare"
   ```
   - Сохраните секрет в защищённом виде; не коммитьте в git.

3. **Kubernetes-развертывание на узле 45.9.41.209**
   - Используем `hostNetwork: true` и привязку к ноде `kczdjomrqi`.
   - Namespace: `canton-node`.
   - Конфиги монтируем из ConfigMap; секреты — из Secret.
   - Подробнее см. раздел [Kubernetes-развертывание (k3s) с фиксированным IP](#kubernetes-развертывание-k3s-с-фиксированным-ip).

4. **Верификация**
   - Health: `http://45.9.41.209:8081/health`
   - (Опционально) Ledger gRPC health: `grpc-health-probe -addr=45.9.41.209:6865` (если включили 6865).

### TestNet: пошаговый запуск

1. **Whitelisting IP**
   - Сообщите вашему SV sponsor фиксированный IP `45.9.41.209` (Россия, Санкт-Петербург) для whitelisting на TestNet.
   - ⚠️ **Важно**: Уточните у SV sponsor, разрешены ли российские IP-адреса для валидаторов Canton Network.

2. **Запрос TestNet onboarding secret**
   - Обратитесь к TestNet endpoint согласно документации. Процесс аналогичен DevNet.

3. **Развёртывание**
   - Дублируйте манифесты/переменные для TestNet, укажите соответствующие endpoints и секрет TestNet.

4. **Проверки**
   - Аналогичны DevNet; убедитесь, что нода подключена к TestNet и проходит health.

### MainNet: пошаговый запуск

1. **Allocation**
   - Дождитесь выделения MainNet allocation (ожидание может быть длительным).

2. **Whitelisting IP**
   - Сообщите SV sponsor IP `45.9.41.209` (Россия, Санкт-Петербург) для MainNet.
   - ⚠️ **Важно**: Уточните у SV sponsor, разрешены ли российские IP-адреса для валидаторов Canton Network.

3. **Onboarding secret для MainNet**
   - Запросите напрямую у SV sponsor согласно их процедурам после получения allocation.

4. **Развёртывание на MainNet**
   - Используйте ту же схему Kubernetes/hostNetwork, изменив только целевые endpoints и секрет.

### Kubernetes-развертывание (k3s) с фиксированным IP

Схема обеспечивает один стабильный IP и прямой входящий доступ без Ingress.

- Namespace: `canton-node` (создаётся один раз).
- Привязка к ноде: `nodeSelector: kubernetes.io/hostname=kczdjomrqi`.
- Host networking: `hostNetwork: true`, `dnsPolicy: ClusterFirstWithHostNet`.
- Томá: `hostPath` на ноде для данных и логов (`/var/lib/canton/{data,logs}`).
- Порты: 8080/8081/8082 из конфигов; при необходимости добавьте 6865 для Ledger API.

Важно: укажите корректный Docker-образ. Плейсхолдеры вида `canton-sync:0.5.8` замените на реальный `registry/repository:tag` (например, GHCR). Если образ приватный — добавьте `imagePullSecrets`.

### Секреты и конфигурация

- Конфиги уже в репозитории:
  - `blockchain/config/canton.conf`
  - `blockchain/config/validator.conf`
- Создайте `ConfigMap` из этих файлов и `Secret` с `ONBOARDING_SECRET`.

Пример команд (DevNet):
```bash
kubectl create namespace canton-node || true

# Конфиги
kubectl -n canton-node create configmap canton-config \
  --from-file=blockchain/config/canton.conf \
  --from-file=blockchain/config/validator.conf \
  --dry-run=client -o yaml | kubectl apply -f -

# Секреты (пример: ONBOARDING_SECRET)
kubectl -n canton-node create secret generic canton-onboarding \
  --from-literal=ONBOARDING_SECRET="<paste-secret-here>" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Подключите секрет в Pod (envFrom/secretRef) и убедитесь, что переменная доступна приложению.

### Верификация и мониторинг

- Health: `http://45.9.41.209:8081/health`
- Metrics (если включено): `http://45.9.41.209:8080/metrics`
- Admin API: `http://45.9.41.209:8082/admin`
- Ledger API gRPC (если включили 6865):
  ```bash
  grpc-health-probe -addr=45.9.41.209:6865
  ```

Наблюдение в Kubernetes:
```bash
kubectl -n canton-node get pods -o wide
kubectl -n canton-node logs -f statefulset/canton-node
kubectl -n canton-node describe pod -l app=canton-node
```

### Траблшутинг

1. **ErrImagePull / ImagePullBackOff**
   - Убедитесь, что указан реальный `image: registry/repo:tag`.
   - Для приватных реестров создайте и привяжите `imagePullSecret`.

2. **Порты заняты** (hostNetwork)
   - Проверьте, свободны ли 8080/8081/8082 (и 6865, если используете):
   ```bash
   sudo lsof -i :8080 || true
   sudo lsof -i :8081 || true
   sudo lsof -i :8082 || true
   sudo lsof -i :6865 || true
   ```
   - Измените порты в конфиге или освободите их на ноде.

3. **Health не отвечает**
   - Проверьте логи контейнера и соответствие путей/портов `validator.conf`/`canton.conf`.
   - Проверьте сетевые ACL/Firewall для входящих соединений на 45.9.41.209.

4. **Не проходит whitelisting**
   - Убедитесь, что SV sponsor whitelisted именно публичный IP узла `45.9.41.209` (Россия, Санкт-Петербург).
   - ⚠️ **КРИТИЧНО**: Текущий IP находится в России. Если Canton Network не принимает российские IP:
     - Рассмотрите аренду сервера с IP из стран ЕС/США
     - Используйте VPN/прокси (не рекомендуется для production)
     - Уточните официальную политику Canton Network по географическим ограничениям
   - На время теста отключите дополнительные фильтры на периметре (если они есть).

5. **Проблемы хранения**
   - Проверьте права на каталоги `/var/lib/canton/data` и `/var/lib/canton/logs` на ноде.

### Безопасность и эксплуатация

- Не коммитьте секреты в git; используйте `Secret` в Kubernetes.
- Ограничьте доступ к Admin API (8082) по IP/NetworkPolicy/FW.
- Рассмотрите TLS для Ledger API/Admin, а также авторизацию (JWT/мутуальная TLS) согласно документации Canton.
- Бэкапы данных валидатора (каталог данных и ключей) — по расписанию, с шифрованием.

### Приложение: полезные команды

Стандартные действия в кластере:
```bash
kubectl -n canton-node get all -o wide
kubectl -n canton-node describe statefulset canton-node
kubectl -n canton-node rollout status statefulset/canton-node
```

Полезные ссылки:
- Официальная документация: [Sync Global Docs](https://sync.global/docs/)
- Репозиторий Canton: `https://github.com/digital-asset/canton`
- Примеры JSON API: раздел Ledger JSON API в официальной документации

---

Примечание: документ поддерживается в актуальном состоянии. Если меняются endpoint’ы/версии образов, обновляйте соответствующие секции (образы, порты, URL для onboarding).





