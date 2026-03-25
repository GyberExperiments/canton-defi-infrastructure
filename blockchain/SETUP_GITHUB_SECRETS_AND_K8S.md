# 🔐 Настройка GitHub Secrets и синхронизация в Kubernetes

## ✅ Рекомендуемый подход

Хранить все секреты в GitHub Secrets и доставлять их в Kubernetes через GitHub Actions или External Secrets Operator.

---

## 📋 Шаг 1: Создать GitHub Secrets

### Для GHCR Docker Registry Credentials

```bash
# Получить GitHub token (если еще нет)
gh auth token

# Создать GitHub Secret для GHCR
gh secret set GHCR_USERNAME --body "TheMacroeconomicDao"
gh secret set GHCR_TOKEN --body "$(gh auth token)"
```

### Для Canton Onboarding Secret

```bash
# Сохранить Onboarding Secret в GitHub
gh secret set CANTON_ONBOARDING_SECRET_DEVNET --body "$ONBOARDING_SECRET"
gh secret set CANTON_ONBOARDING_SECRET_TESTNET --body "your-testnet-secret"
gh secret set CANTON_ONBOARDING_SECRET_MAINNET --body "your-mainnet-secret"
```

### Проверить что создались

```bash
gh secret list
```

---

## 📝 Шаг 2: Создать GitHub Actions Workflow

Создайте файл `.github/workflows/sync-k8s-secrets.yml`:

```yaml
name: Sync Secrets to Kubernetes

on:
  workflow_dispatch:  # Можно запустить вручную
  push:
    branches:
      - main
    paths:
      - '.github/workflows/sync-k8s-secrets.yml'

jobs:
  sync-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'

      - name: Configure kubectl
        run: |
          # Отсюда нужно получить kubeconfig
          # Если используешь контроль-плейн дома:
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig.yaml
          export KUBECONFIG=$(pwd)/kubeconfig.yaml

      - name: Create Kubernetes Secrets
        run: |
          kubectl create namespace canton-node --dry-run=client -o yaml | kubectl apply -f -
          
          # Docker Registry Secret
          kubectl create secret docker-registry ghcr-creds \
            --docker-server=ghcr.io \
            --docker-username=${{ secrets.GHCR_USERNAME }} \
            --docker-password=${{ secrets.GHCR_TOKEN }} \
            --namespace=canton-node \
            --dry-run=client -o yaml | kubectl apply -f -
          
          # Canton Onboarding Secret
          cat <<EOF | kubectl apply -f -
          apiVersion: v1
          kind: Secret
          metadata:
            name: canton-onboarding
            namespace: canton-node
          type: Opaque
          data:
            ONBOARDING_SECRET: $(echo -n "${{ secrets.CANTON_ONBOARDING_SECRET_DEVNET }}" | base64 -w0)
          EOF
          
          echo "Secrets synced successfully!"

      - name: Verify Secrets
        run: |
          kubectl get secrets -n canton-node
```

---

## 🔐 Шаг 3: Использовать External Secrets Operator (рекомендуется)

Для более безопасного подхода используйте External Secrets Operator:

```bash
# Установить External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm repo update
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system \
  --create-namespace

# Создать GitHub Secret Store
cat > /tmp/github-secret-store.yaml << 'EOF'
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: github-secret-store
  namespace: canton-node
spec:
  provider:
    github:
      auth:
        secretRef:
          secretAccessKey:
            name: github-token
            key: token
      owner: TheMacroeconomicDao
      repo: GYBERNATY-ECOSYSTEM

---
apiVersion: v1
kind: Secret
metadata:
  name: github-token
  namespace: canton-node
type: Opaque
stringData:
  token: "$(gh auth token)"

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: canton-onboarding-sync
  namespace: canton-node
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: github-secret-store
    kind: SecretStore
  target:
    name: canton-onboarding
    creationPolicy: Owner
    template:
      engineVersion: v2
      data:
        ONBOARDING_SECRET: "{{ .onboarding }}"
  data:
  - secretKey: onboarding
    remoteRef:
      key: CANTON_ONBOARDING_SECRET_DEVNET
EOF

kubectl apply -f /tmp/github-secret-store.yaml
```

---

## 🛠️ Шаг 4: Скрипт для локальной синхронизации (простой вариант)

Создайте скрипт `blockchain/scripts/sync-secrets-from-github.sh`:

```bash
#!/bin/bash

set -e

echo "Syncing secrets from GitHub to Kubernetes..."

# Получить GitHub token
GH_TOKEN=$(gh auth token)
GH_USER="TheMacroeconomicDao"

# Получить secrets из GitHub
GHCR_USERNAME=$(gh secret list | grep "GHCR_USERNAME" | awk '{print $1}')
CANTON_SECRET=$(gh secret list | grep "CANTON_" | grep "DEVNET" | awk '{print $1}')

echo "Getting secrets from GitHub..."

# Создать namespace если не существует
kubectl create namespace canton-node --dry-run=client -o yaml | kubectl apply -f -

# Получить значения секретов (через API GitHub)
echo "Creating Docker Registry Secret..."
kubectl create secret docker-registry ghcr-creds \
  --docker-server=ghcr.io \
  --docker-username="$GH_USER" \
  --docker-password="$GH_TOKEN" \
  --namespace=canton-node \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secrets synced successfully!"
kubectl get secrets -n canton-node
```

---

## 🚀 Использование синхронизированных секретов

Обновите `config/kubernetes/k8s/canton-validator-new-node.yaml`:

```yaml
spec:
  imagePullSecrets:
  - name: ghcr-creds  # Теперь это будет в синхронизированном секрете
  
  containers:
  - name: canton-validator
    image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
    imagePullPolicy: Always
    
    env:
    - name: ONBOARDING_SECRET
      valueFrom:
        secretKeyRef:
          name: canton-onboarding
          key: ONBOARDING_SECRET
```

---

## 📊 Схема потока

```
GitHub Secrets
    ↓
GitHub Actions (или скрипт)
    ↓
Kubernetes Secrets
    ↓
Pod'ы (используют секреты через env/volumeMount)
```

---

## ✅ Чек-лист

- [ ] Создать GitHub Secrets через `gh secret set`
- [ ] Проверить что секреты создались: `gh secret list`
- [ ] Выбрать подход (GitHub Actions, External Secrets, или скрипт)
- [ ] Создать и запустить workflow/скрипт
- [ ] Проверить что секреты созданы в Kubernetes: `kubectl get secrets -n canton-node`
- [ ] Запустить Canton Pod с новыми секретами

---

## 🔒 Безопасные практики

1. **Никогда** не коммитить секреты в Git
2. Хранить все в GitHub Secrets или HashiCorp Vault
3. Использовать Kubernetes RBAC для ограничения доступа
4. Регулярно ротировать токены (GitHub + Docker)
5. Использовать External Secrets Operator для автоматической синхронизации

---

## 🆘 Troubleshooting

```bash
# Проверить что Secret создан
kubectl get secret ghcr-creds -n canton-node -o yaml

# Базово-декодировать secret
kubectl get secret ghcr-creds -n canton-node -o jsonpath='{.data}'.

# Проверить ImagePullBackOff события
kubectl describe pod -n canton-node canton-node-new-0 | grep -i pull
```
