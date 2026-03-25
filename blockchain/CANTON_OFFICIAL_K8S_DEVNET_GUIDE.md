# Развёртывание Canton Validator в Kubernetes и подключение к DevNet (по официальной документации)

**Источники:**
- [Kubernetes-Based Deployment of a Validator node](https://docs.dev.global.canton.network.sync.global/validator_operator/validator_helm.html) (Splice / Canton)
- [Validator Node Setup](https://docs.digitalasset.com/utilities/testnet/canton-utility-setup/validator-setup.html) (Digital Asset)

---

## 1. Требования

- Kubernetes (kubectl ≥ v1.26.1, Helm ≥ v3.11.1)
- Статический egress IP — передать SV sponsor для добавления в allowlist (у нас: **65.108.15.30**, уже валидирован для DevNet)
- Доступ в кластер с правами на создание namespace и установку Helm-чартов

---

## 2. Параметры сети для DevNet

| Параметр | Значение для DevNet |
|----------|----------------------|
| **MIGRATION_ID** | Текущий migration id с https://sync.global/sv-network/ (секция DevNet) |
| **SPONSOR_SV_URL** | `https://sv.sv-1.dev.global.canton.network.sync.global` |
| **TRUSTED_SCAN_URL** | `https://scan.sv-1.dev.global.canton.network.sync.global` |
| **ONBOARDING_SECRET** | DevNet: получить самовыдачей (см. ниже), действует **1 час** |

### Получение onboarding secret для DevNet

Запрос нужно выполнять **с машины с egress IP 65.108.15.30** (API DevNet принимает только с whitelisted IP).

```bash
curl -X POST https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare
```

В ответе JSON — поле `onboarding_secret`. Или через скрипт проекта (запускать на ноде с нужным IP):

```bash
./scripts/get-onboarding-secret.sh devnet --save
```

---

## 3. Подготовка кластера (официальные шаги)

**Быстрая подготовка (namespace + секреты):** из корня репозитория можно запустить скрипт, который создаёт namespace, postgres-secrets и splice-app-validator-onboarding-validator (получает DevNet secret через `get-onboarding-secret.sh`):

```bash
chmod +x scripts/deploy-canton-validator-helm-devnet.sh
./scripts/deploy-canton-validator-helm-devnet.sh
```

Переменные окружения: `CANTON_NAMESPACE` (по умолчанию `validator`), `CHART_VERSION` (по умолчанию `0.5.7`), `POSTGRES_PASSWORD` (если не задан — запросит ввод).

Ниже — те же шаги вручную.

### 3.1 Namespace

Один валидатор на один namespace. В документации используется имя **`validator`**:

```bash
kubectl create ns validator
```

### 3.2 Секрет PostgreSQL

```bash
export POSTGRES_PASSWORD='<надёжный_пароль>'
kubectl create secret generic postgres-secrets \
  --from-literal=postgresPassword="${POSTGRES_PASSWORD}" \
  -n validator
```

### 3.3 Секрет onboarding

```bash
export ONBOARDING_SECRET='<значение_из_curl_или_скрипта>'
kubectl create secret generic splice-app-validator-onboarding-validator \
  --from-literal=secret="${ONBOARDING_SECRET}" \
  -n validator
```

### 3.4 (Опционально) Аутентификация OIDC

Для продакшена нужен OIDC. **Без auth** (только для теста) в values добавляют `disableAuth: true` в participant и validator values. При `disableAuth: true` создавать OIDC-секреты не нужно.

---

## 4. Скачивание бандла и настройка values

### 4.1 Скачать бандл с примерами values

Актуальные релизы: https://github.com/digital-asset/decentralized-canton-sync/releases

Пример для версии **0.5.7**:

```bash
export CHART_VERSION=0.5.7
curl -sL -o /tmp/splice-node.tar.gz \
  "https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${CHART_VERSION}/${CHART_VERSION}_splice-node.tar.gz"
mkdir -p /tmp/splice-node && tar xzvf /tmp/splice-node.tar.gz -C /tmp/splice-node
```

Структура после распаковки: каталог с примерами `examples/sv-helm/`.

### 4.2 Правки в values для DevNet

В проекте уже подготовлены values в **k8s/helm-devnet/** (postgres-values-devnet.yaml, participant-values-devnet.yaml, standalone-participant-values-devnet.yaml, validator-values-devnet.yaml, standalone-validator-values-devnet.yaml): MIGRATION_ID, SPONSOR_SV_URL, TRUSTED_SCAN_URL, party hint, disableAuth: true, nodeSelector на canton-node-65-108-15-30.

---

## 5. Установка Helm-чартов (официальный порядок)

Чарты ставятся из OCI-репозитория, по одному, с ожиданием готовности. Либо вручную (см. гайд ниже), либо **одной командой**:

```bash
cd blockchain
chmod +x scripts/run-helm-devnet-deploy.sh
./scripts/run-helm-devnet-deploy.sh
```

Скрипт скачивает бандл, распаковывает, ставит postgres → participant → validator с values из k8s/helm-devnet/.

Вручную (из каталога с распакованным бандлом, переменная SV_HELM — путь к examples/sv-helm):

```bash
export CHART_VERSION=0.5.7
export NS=validator
HELM_DEVNET="$(pwd)/k8s/helm-devnet"

# 1) PostgreSQL
helm install postgres oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-postgres \
  -n $NS --version ${CHART_VERSION} \
  -f $SV_HELM/postgres-values-validator-participant.yaml \
  -f $HELM_DEVNET/postgres-values-devnet.yaml \
  --wait

# 2) Participant
helm install participant oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-participant \
  -n $NS --version ${CHART_VERSION} \
  -f $SV_HELM/participant-values.yaml \
  -f $SV_HELM/standalone-participant-values.yaml \
  -f $HELM_DEVNET/participant-values-devnet.yaml \
  -f $HELM_DEVNET/standalone-participant-values-devnet.yaml \
  --wait

# 3) Validator
helm install validator oci://ghcr.io/digital-asset/decentralized-canton-sync/helm/splice-validator \
  -n $NS --version ${CHART_VERSION} \
  -f $SV_HELM/validator-values.yaml \
  -f $SV_HELM/standalone-validator-values.yaml \
  -f $HELM_DEVNET/validator-values-devnet.yaml \
  -f $HELM_DEVNET/standalone-validator-values-devnet.yaml \
  --wait
```

После установки в namespace должны быть поды: postgres-0, participant-..., validator-app-..., wallet-web-ui-..., ans-web-ui-...

---

## 6. Статический IP (egress) и размещение на ноде 65.108.15.30

В values в k8s/helm-devnet/ задан nodeSelector: `kubernetes.io/hostname: canton-node-65-108-15-30`, чтобы поды шли на ноду с egress IP 65.108.15.30.

---

## 7. Ingress (доступ к UI и API)

По документации: Wallet UI, Validator API (порт 5003), CNS (ANS) UI. Для быстрого теста можно NodePort/LoadBalancer.

---

## 8. Проверка подключения к DevNet

```bash
kubectl get pods -n validator
kubectl logs -n validator -l app.kubernetes.io/name=splice-validator -f --tail=100
kubectl port-forward -n validator svc/validator-app 5003:5003
curl -s http://localhost:5003/api/validator/version
```

---

## 9. Оставшиеся шаги (пошагово)

**Важно:** все шаги ниже нужно выполнять **с ноды/машины с egress IP 65.108.15.30** (нода `canton-node-65-108-15-30` или сервер с этим IP). API DevNet выдаёт onboarding secret только с whitelisted IP; `kubectl`/`helm` должны иметь доступ к кластеру (kubeconfig на этой же ноде или KUBECONFIG к кластеру).

**Вариант А — с локальной машины одним скриптом (SSH на ноду, репо уже на ноде):**

```bash
# Репо на ноде в /root/canton-otc/blockchain (или передать путь аргументом)
./scripts/run-devnet-steps-on-node.sh
# или с другим путём: ./scripts/run-devnet-steps-on-node.sh /opt/canton-otc/blockchain
```

Переменные: `DEVNET_NODE_IP=65.108.15.30`, `SSH_USER=root`, `SSH_KEY=$HOME/.ssh/id_rsa_canton`. Репо на ноду можно скопировать: `rsync -avz -e "ssh -i $SSH_KEY" blockchain/ root@65.108.15.30:/root/canton-otc/blockchain/`

**Вариант Б — зайти по SSH на ноду и выполнить там:**

```bash
ssh root@65.108.15.30   # или свой пользователь
cd /path/to/canton-otc/blockchain   # репо должен быть на ноде или склонирован
```

После того как namespace и postgres-secrets уже есть:

**Шаг 1 — получить свежий DevNet onboarding secret (действует 1 час):**

С ноды с IP 65.108.15.30 (или **из кластера** — Job на этой ноде, egress = тот же IP):

```bash
# Вариант: из кластера (kubectl с любой машины с kubeconfig) — Job запускается на ноде 65.108.15.30
kubectl apply -f blockchain/k8s/devnet-refresh-onboarding-secret-job.yaml
kubectl -n validator logs job/devnet-refresh-onboarding-secret -f
```

Или с ноды по SSH:

```bash
cd blockchain
./scripts/get-onboarding-secret.sh devnet --save
```

Или вручную:

```bash
curl -s -X POST https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare | jq -r '.onboarding_secret'
```

**Шаг 2 — обновить K8s secret:**

Если секрет уже есть (обновление):

```bash
export ONBOARDING_SECRET='<значение_из_шага_1>'
kubectl create secret generic splice-app-validator-onboarding-validator \
  --from-literal=secret="${ONBOARDING_SECRET}" \
  -n validator --dry-run=client -o yaml | kubectl apply -f -
```

Или через скрипт (подтянет из blockchain/config/onboarding-secrets.env или API):

```bash
./scripts/update-onboarding-secret.sh devnet
```

Если секрета ещё нет — создать:

```bash
kubectl create secret generic splice-app-validator-onboarding-validator \
  --from-literal=secret="${ONBOARDING_SECRET}" \
  -n validator
```

**Шаг 3 — запустить полный Helm-деплой:**

```bash
cd blockchain
./scripts/run-helm-devnet-deploy.sh
```

---

## 10. Краткий чеклист

- [ ] Namespace создан: `kubectl create ns validator`.
- [ ] Secret `postgres-secrets` с `postgresPassword`.
- [ ] Secret `splice-app-validator-onboarding-validator` с актуальным DevNet onboarding secret (обновлять раз в 1 час или перед деплоем).
- [ ] Values в k8s/helm-devnet/ с MIGRATION_ID, SPONSOR_SV_URL, TRUSTED_SCAN_URL, nodeSelector на canton-node-65-108-15-30.
- [ ] Установлены в порядке: postgres → participant → validator (Helm, с `--wait`).
- [ ] Egress с ноды 65.108.15.30.

---

## 11. Ссылки

- Validator Helm (DevNet): https://docs.dev.global.canton.network.sync.global/validator_operator/validator_helm.html
- Validator Node Setup (DA): https://docs.digitalasset.com/utilities/testnet/canton-utility-setup/validator-setup.html
- SV Network (MIGRATION_ID): https://sync.global/sv-network/
- Релизы и бандлы: https://github.com/digital-asset/decentralized-canton-sync/releases
