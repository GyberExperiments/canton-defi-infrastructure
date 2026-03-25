# 🔧 Исправление всех проблем проектов

> **Дата создания:** 19 января 2026  
> **Статус:** ✅ Готово к применению

## 📋 Обзор проблем и решений

### ❌ КРИТИЧНО: 1OTC SSL сертификат
**Проблема:** Сертификат невалиден для `1otc.cc` - браузеры блокируют доступ  
**Решение:** 
- Установка Cert-Manager
- Создание ClusterIssuer для Let's Encrypt
- Создание Certificate ресурса для всех трёх доменов (1otc.cc, cantonotc.com, canton-otc.com)

### ❌ ВЫСОКИЙ: Multi-swarm отсутствует Service
**Проблема:** Deployment работает (3/3 pods), но Service отсутствует  
**Решение:** Создание Service для multi-swarm-system-prod deployment

### ⚠️ СРЕДНИЙ: 1OTC ConfigMap доступ запрещён
**Проблема:** ServiceAccount не имеет прав на чтение ConfigMap  
**Решение:** Применение RBAC конфигурации (Role и RoleBinding)

---

## 🚀 Быстрый старт

### Автоматическое исправление всех проблем

```bash
# Из корня проекта
./scripts/fix-all-projects-issues.sh
```

Скрипт автоматически:
1. ✅ Проверит и установит Cert-Manager (если нужно)
2. ✅ Создаст ClusterIssuer для Let's Encrypt
3. ✅ Создаст Certificate для всех трёх доменов 1OTC
4. ✅ Создаст Service для multi-swarm-system
5. ✅ Применит RBAC для доступа к ConfigMap
6. ✅ Перезапустит deployment для применения прав
7. ✅ Проверит результаты

---

## 📁 Созданные файлы

### Конфигурации Kubernetes

1. **`certificate.yaml`** - Certificate ресурс для SSL сертификата 1OTC
   - Домены: 1otc.cc, cantonotc.com, canton-otc.com
   - Использует ClusterIssuer: letsencrypt-prod

2. **`clusterissuer.yaml`** - ClusterIssuer для Let's Encrypt
   - Production окружение
   - HTTP-01 challenge через Traefik

3. **`multi-swarm-service.yaml`** - Service для multi-swarm-system
   - Namespace: default
   - Port: 80 → 80
   - Selector: app=multi-swarm-system, environment=production

4. **`configmap-rbac.yaml`** - RBAC для доступа к ConfigMap (уже существовал)
   - ServiceAccount: canton-otc-configmap-manager
   - Role: canton-otc-configmap-editor
   - Права: get, list, watch, patch, update

### Скрипты

1. **`scripts/fix-all-projects-issues.sh`** - Комплексный скрипт исправления
   - Автоматическая проверка существующих ресурсов
   - Умное применение только недостающих конфигураций
   - Проверка результатов

---

## 🔧 Ручное применение (пошагово)

### Шаг 1: Установка Cert-Manager

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Установить CRDs
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.crds.yaml

# Установить cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Дождаться готовности
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=180s
```

### Шаг 2: Создание ClusterIssuer

```bash
kubectl apply -f config/kubernetes/k8s/clusterissuer.yaml
```

### Шаг 3: Создание Certificate для 1OTC

```bash
kubectl apply -f config/kubernetes/k8s/certificate.yaml

# Проверить статус (может занять 1-5 минут)
kubectl get certificate -n canton-otc
kubectl describe certificate canton-otc-tls -n canton-otc
```

### Шаг 4: Создание Service для Multi-swarm

```bash
kubectl apply -f config/kubernetes/k8s/multi-swarm-service.yaml

# Проверить endpoints
kubectl get endpoints multi-swarm-system-prod-service -n default
```

### Шаг 5: Применение RBAC для ConfigMap

```bash
kubectl apply -f config/kubernetes/k8s/configmap-rbac.yaml

# Проверить права
kubectl auth can-i get configmaps/canton-otc-config \
  --as=system:serviceaccount:canton-otc:canton-otc-configmap-manager \
  -n canton-otc

# Перезапустить deployment
kubectl rollout restart deployment/canton-otc -n canton-otc
kubectl rollout status deployment/canton-otc -n canton-otc
```

---

## ✅ Проверка результатов

### Проверка SSL сертификата

```bash
# Проверить статус Certificate
kubectl get certificate -n canton-otc

# Проверить Subject Alternative Name
kubectl get secret canton-otc-tls -n canton-otc -o jsonpath='{.data.tls\.crt}' | \
  base64 -d | openssl x509 -noout -text | grep -A3 "Subject Alternative Name"

# Должно показать:
# DNS:1otc.cc
# DNS:cantonotc.com
# DNS:canton-otc.com
```

### Проверка Multi-swarm Service

```bash
# Проверить Service
kubectl get svc multi-swarm-system-prod-service -n default

# Проверить Endpoints
kubectl get endpoints multi-swarm-system-prod-service -n default

# Проверить доступность
curl -H "Host: multi-swarm-system.gyber.org" http://127.0.0.1
```

### Проверка ConfigMap прав

```bash
# Проверить права доступа
kubectl auth can-i get configmaps/canton-otc-config \
  --as=system:serviceaccount:canton-otc:canton-otc-configmap-manager \
  -n canton-otc

# Проверить логи (не должно быть ошибок 403)
kubectl logs -n canton-otc -l app=canton-otc --tail=20 | grep -i configmap
```

### Проверка HTTP/HTTPS доступности

```bash
# Проверить 1OTC
curl -I https://1otc.cc
curl -I https://cantonotc.com
curl -I https://canton-otc.com

# Проверить Multi-swarm
curl -I https://multi-swarm-system.gyber.org
```

---

## 🐛 Устранение проблем

### Certificate не выдаётся

```bash
# Проверить статус Certificate
kubectl describe certificate canton-otc-tls -n canton-otc

# Проверить CertificateRequest
kubectl get certificaterequests -n canton-otc

# Проверить Challenges
kubectl get challenges -n canton-otc

# Проверить логи cert-manager
kubectl logs -n cert-manager -l app.kubernetes.io/instance=cert-manager
```

### Service не создаёт endpoints

```bash
# Проверить labels deployment
kubectl get deployment multi-swarm-system-prod -n default -o jsonpath='{.spec.selector.matchLabels}'

# Проверить labels подов
kubectl get pods -n default -l app=multi-swarm-system,environment=production --show-labels

# Убедиться, что labels совпадают
```

### RBAC не работает

```bash
# Проверить ServiceAccount
kubectl get serviceaccount canton-otc-configmap-manager -n canton-otc

# Проверить Role
kubectl get role canton-otc-configmap-editor -n canton-otc

# Проверить RoleBinding
kubectl get rolebinding canton-otc-configmap-editor-binding -n canton-otc

# Проверить, что deployment использует правильный ServiceAccount
kubectl get deployment canton-otc -n canton-otc -o jsonpath='{.spec.template.spec.serviceAccountName}'
```

---

## 📝 Важные замечания

1. **DNS записи:** Убедитесь, что все домены указывают на правильные IP:
   - `1otc.cc` → 31.129.105.180 ✅
   - `cantonotc.com` → 45.9.41.209 (проверить!)
   - `canton-otc.com` → 45.9.41.209 (проверить!)

2. **Let's Encrypt лимиты:** Не более 50 сертификатов в неделю на домен

3. **Traefik порты:** Убедитесь, что порты 80 и 443 открыты для Let's Encrypt challenges

4. **Email для уведомлений:** Укажите реальный email в ClusterIssuer (сейчас: admin@gyber.org)

5. **Время выдачи сертификата:** Может занять 1-5 минут после создания Certificate ресурса

---

## 🔗 Связанные файлы

- `PROJECTS_VERSION_UPDATE_CHECK_REPORT.md` - Отчёт о проблемах
- `1OTC_SSL_CERTIFICATE_FIX.md` - Детальное описание проблемы SSL
- `config/kubernetes/k8s/ingress.yaml` - Ingress конфигурация (обновлена - удалена аннотация cert-manager.io/cluster-issuer)

---

**Автор:** Senior DevOps Engineer  
**Дата:** 19 января 2026
