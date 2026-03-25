# 🚀 Быстрое исправление всех проблем проектов

## ✅ Что было сделано

1. **Создан Certificate ресурс** для SSL сертификата 1OTC (все три домена)
2. **Создан ClusterIssuer** для Let's Encrypt
3. **Создан Service** для multi-swarm-system
4. **Обновлён Ingress** (удалена аннотация cert-manager.io/cluster-issuer)
5. **Создан комплексный скрипт** для автоматического исправления

## 🎯 Применение исправлений

### Вариант 1: Автоматический (рекомендуется)

```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc
./scripts/fix-all-projects-issues.sh
```

Скрипт автоматически исправит все проблемы.

### Вариант 2: Ручной (пошагово)

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# 1. Установить Cert-Manager (если не установлен)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.crds.yaml
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# 2. Применить все конфигурации
kubectl apply -f config/kubernetes/k8s/clusterissuer.yaml
kubectl apply -f config/kubernetes/k8s/certificate.yaml
kubectl apply -f config/kubernetes/k8s/multi-swarm-service.yaml
kubectl apply -f config/kubernetes/k8s/configmap-rbac.yaml

# 3. Перезапустить deployment
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## 📋 Созданные файлы

- `config/kubernetes/k8s/certificate.yaml` - Certificate для SSL
- `config/kubernetes/k8s/clusterissuer.yaml` - ClusterIssuer для Let's Encrypt
- `config/kubernetes/k8s/multi-swarm-service.yaml` - Service для multi-swarm
- `scripts/fix-all-projects-issues.sh` - Скрипт автоматического исправления
- `config/kubernetes/k8s/FIX_ALL_ISSUES_README.md` - Подробная документация

## ⚠️ Важно

1. Certificate может занять 1-5 минут для выдачи
2. Проверьте DNS записи для всех доменов
3. Убедитесь, что порты 80 и 443 открыты для Let's Encrypt

## 🔍 Проверка после применения

```bash
# Проверить Certificate
kubectl get certificate -n canton-otc

# Проверить Service
kubectl get svc multi-swarm-system-prod-service -n default

# Проверить права ConfigMap
kubectl auth can-i get configmaps/canton-otc-config \
  --as=system:serviceaccount:canton-otc:canton-otc-configmap-manager \
  -n canton-otc
```

Подробная документация: `config/kubernetes/k8s/FIX_ALL_ISSUES_README.md`
