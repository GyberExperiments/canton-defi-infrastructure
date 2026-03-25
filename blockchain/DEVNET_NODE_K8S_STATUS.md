# Статус Canton Validator: проект vs кластер

**Дата**: по файлам проекта и `kubectl`

---

## Что описано в проекте (Kubernetes)

### 1. Манифест стека

**Файл:** `k8s/canton-validator-full-stack.yaml`

| Ресурс | Namespace | Назначение |
|--------|-----------|------------|
| ConfigMap `canton-validator-env` | canton-node | DevNet, postgres, party hint |
| StatefulSet `postgres-splice` | canton-node | БД Canton |
| Deployment `canton-participant` | canton-node | Participant |
| Deployment `validator-app` | canton-node | Validator (DevNet) |
| Service `postgres-splice`, `participant`, `validator` | canton-node | Внутренние сервисы |
| Service `canton-validator-health` | canton-node | LoadBalancer, externalIP 65.108.15.30, порт 8081→5003 |

- **Нода:** `nodeSelector: canton-node-65-108-15-30`
- **Сеть:** DevNet (`SCAN_ADDRESS`, `SPONSOR_SV_ADDRESS` → scan.sv-1.dev...)
- **Зависимости:** Secret `canton-onboarding` (ключ `ONBOARDING_SECRET`), при необходимости `imagePullSecrets: ghcr-creds`
- **Образ validator:** `ghcr.io/digital-asset/decentralized-canton-sync/docker/validator-app:0.5.8`

### 2. README (быстрый старт)

**Вариант 1 — Kubernetes:**

```bash
./scripts/connect-all-ips-to-cluster.sh
kubectl apply -f k8s/canton-validator-full-stack.yaml
```

То есть по задумке нода должна быть в **namespace `canton-node`**.

### 3. Скрипт деплоя

**Файл:** `scripts/deploy-canton-validator.sh`

- Может получать onboarding secret через `get-onboarding-secret.sh`
- Ожидает манифесты в `config/kubernetes/k8s` (в проекте K8s лежит в `blockchain/k8s/`)

---

## Что есть в кластере (kubectl)

| Проверка | Результат |
|----------|-----------|
| Namespace `canton-node` | **Нет** (есть только `canton-otc`, `default`, и др.) |
| Поды/сервисы Canton Validator в K8s | **Нет** |
| Нода `canton-node-65-108-15-30` | **Есть**, Ready, IP 65.108.15.30 |

Итог: **Canton Validator по манифестам проекта в Kubernetes не развёрнут.**  
Сейчас работающая нода (65.108.15.30:8080, health, validator 0.5.3) — это **Docker Compose на хосте**, а не поды в `canton-node`.

---

## Чтобы нода была в кубере

1. **Создать namespace**
   ```bash
   kubectl create namespace canton-node
   ```

2. **Создать Secret с onboarding (DevNet)**
   ```bash
   # Свежий секрет (действует 1 час)
   ./scripts/get-onboarding-secret.sh devnet --save
   # Подставить значение из config/onboarding-secrets.env
   kubectl create secret generic canton-onboarding -n canton-node \
     --from-literal=ONBOARDING_SECRET='<значение DEVNET_ONBOARDING_SECRET>'
   ```

3. **При необходимости — imagePullSecrets для ghcr.io**
   ```bash
   kubectl create secret docker-registry ghcr-creds -n canton-node \
     --docker-server=ghcr.io \
     --docker-username=<GITHUB_USER> \
     --docker-password=<GITHUB_PAT> \
     --docker-email=<EMAIL>
   ```

4. **Применить стек**
   ```bash
   kubectl apply -f k8s/canton-validator-full-stack.yaml
   ```

5. **Проверить**
   ```bash
   kubectl get pods -n canton-node -o wide
   kubectl get svc -n canton-node
   # Health: http://65.108.15.30:8081/health (если LoadBalancer с externalIP отработает)
   ```

---

## Важно по версиям

- В **манифесте** указан образ validator **0.5.8**.
- На хосте (Docker) у вас уже **0.5.3**.
- Для перехода в K8s на 0.5.3 нужно в `k8s/canton-validator-full-stack.yaml` заменить образ validator-app на тег **0.5.3** (если такой есть в `ghcr.io/digital-asset/...`).

---

**Итог:** В файлах проекта нода описана в Kubernetes (namespace `canton-node`, `k8s/canton-validator-full-stack.yaml`). В текущем кластере этот стек не применён; нода работает как Docker Compose на 65.108.15.30. Чтобы нода была в кубере — создать `canton-node`, секреты и выполнить `kubectl apply -f k8s/canton-validator-full-stack.yaml`.
