# 🔧 ПРОМПТ: ИСПРАВЛЕНИЕ И ВЕРИФИКАЦИЯ ПРОЕКТОВ GYBERNATY ECOSYSTEM

> **Дата обновления:** 19 января 2026, 02:58 UTC  
> **Экосистема:** GYBERNATY ECOSYSTEM  
> **Текущий статус:** ✅ 4/5 проектов работают | ⚠️ 1 проект требует исправления DNS

---

## 📊 ТЕКУЩИЙ СТАТУС (Актуально)

| Проект | HTTPS | SSL | Pods | Статус |
|--------|-------|-----|------|--------|
| **1OTC** | ✅ 200 | ✅ Let's Encrypt (1otc.cc) | 2/2 | ✅ **РАБОТАЕТ** |
| **DSP** | ✅ 200 | ✅ | 3/3 | ✅ **РАБОТАЕТ** |
| **Maximus** | ✅ 200 | ✅ | 1/1 | ✅ **РАБОТАЕТ** |
| **Multi-swarm** | ✅ 200 | ✅ Let's Encrypt | 3/3 | ✅ **РАБОТАЕТ** |
| **Techhy** | ❌ 503 | ⚠️ | 2/2 | ⚠️ **DNS НЕ НА КЛАСТЕРЕ** |

---

## 🚨 ПРОБЛЕМА: TECHHY DNS

**Домены techhy.app и techhy.me НЕ указывают на наш кластер:**

| Домен | Текущий IP | Правильный IP | Статус |
|-------|-----------|---------------|--------|
| `techhy.app` | **45.9.41.209, 46.173.18.60** | 31.129.105.180 | ❌ **НЕПРАВИЛЬНО** |
| `techhy.me` | **5.45.121.80** | 31.129.105.180 | ❌ **НЕПРАВИЛЬНО** |

**Решение:** Обновить A-записи в DNS провайдере на `31.129.105.180`

---

## 🔮 БУДУЩИЕ ЗАДАЧИ: 1OTC ДОПОЛНИТЕЛЬНЫЕ ДОМЕНЫ

Когда DNS для `cantonotc.com` и `canton-otc.com` будет исправлен:

1. Обновить Certificate для 1OTC:
```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
# Удалить текущий certificate
kubectl delete certificate canton-otc-tls-single -n canton-otc

# Создать новый с тремя доменами
cat <<YAML | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: canton-otc-tls
  namespace: canton-otc
spec:
  secretName: canton-otc-tls
  issuerRef:
    kind: ClusterIssuer
    name: letsencrypt-prod
  dnsNames:
  - 1otc.cc
  - cantonotc.com
  - canton-otc.com
YAML
EOF
```

---

## 🎯 ПРОЕКТЫ GYBERNATY ECOSYSTEM

### Полная информация о проектах

| # | Проект | Namespace | Домены | Docker образ | Порт | Локальный путь |
|---|--------|-----------|--------|--------------|------|----------------|
| 1 | **Techhy** | `techhy-main-production` | techhy.app, techhy.me | `ghcr.io/gyberexperiment/tech-hy-ecosystem:main-*` | 80 | `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/` |
| 2 | **1OTC** | `canton-otc` | 1otc.cc, cantonotc.com, canton-otc.com | `ghcr.io/themacroeconomicdao/cantonotc:*` | 3000 | `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/` |
| 3 | **DSP** | `default` | gyber.org, www.gyber.org | `ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:*` | 3000 | `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP/` |
| 4 | **Maximus** | `maximus` | maximus-marketing-swarm.gyber.org | `ghcr.io/themacroeconomicdao/maximus:latest` | 3000 | `/Users/Gyber/GYBERNATY-ECOSYSTEM/maximus/` |
| 5 | **Multi-swarm** | `default` | multi-swarm-system.gyber.org | `ghcr.io/themacroeconomicdao/multi-swarm-system:main` | 80 | `/Users/Gyber/GYBERNATY-ECOSYSTEM/multi-swarm-system/` |

### Структура директории GYBERNATY ECOSYSTEM

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/
├── canton-otc/              # 1OTC - OTC Trading Platform (Next.js)
│   ├── config/kubernetes/k8s/  # K8s манифесты
│   ├── src/                    # Исходный код
│   └── Dockerfile
├── tech-hy-ecosystem/       # Techhy - DeFi Platform (Next.js + Hardhat)
│   ├── frontend/               # Frontend приложение
│   ├── k8s/                    # K8s манифесты
│   └── contracts/              # Smart contracts
├── DSP/                     # Digital Solutions Platform (Next.js)
│   ├── k8s/                    # K8s манифесты
│   ├── src/                    # Исходный код
│   └── Dockerfile
├── maximus/                 # Maximus Marketing Swarm (Next.js + Prisma)
│   ├── k8s/                    # K8s манифесты
│   ├── src/                    # Исходный код
│   └── prisma/                 # Database schema
├── multi-swarm-system/      # Multi-Agent Swarm System (nginx/static)
│   └── multi-swarm-system/     # Исходный код
├── aura-domus/              # Не задеплоен
├── GPROD/                   # Не задеплоен
├── g-wallet/                # Не задеплоен
├── SWARM/                   # Не задеплоен
└── ...
```

---

## 🔧 ИНФРАСТРУКТУРА

### SSH доступ

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180
```

### IP адреса кластера K3S

| Узел | IP | Hostname |
|------|-----|----------|
| Основной | `31.129.105.180` | tmedm |
| Узел 2 | `65.108.15.30` | canton-node-65-108-15-30 |
| Узел 3 | `46.173.18.60` | upbewhtibq |

### Cert-Manager

- **Версия:** v1.13.3
- **Статус:** ✅ 3 pods Running
- **ClusterIssuer:** `letsencrypt-prod` (ACME HTTP-01 через Traefik)

### DNS записи (актуально)

| Домен | IP | Статус |
|-------|-----|--------|
| `1otc.cc` | 31.129.105.180 | ✅ Правильно |
| `cantonotc.com` | 45.9.41.209 | ❌ Неправильно |
| `canton-otc.com` | 45.9.41.209 | ❌ Неправильно |
| `techhy.app` | 45.9.41.209, 46.173.18.60 | ❌ Неправильно |
| `techhy.me` | 5.45.121.80 | ❌ Неправильно |
| `gyber.org` | 31.129.105.180 | ✅ Правильно |
| `maximus-marketing-swarm.gyber.org` | 31.129.105.180 | ✅ Правильно |
| `multi-swarm-system.gyber.org` | 31.129.105.180 | ✅ Правильно |

---

## ✅ ЧТО БЫЛО ИСПРАВЛЕНО

### 19 января 2026:

1. **Cert-Manager v1.13.3** установлен
   - ResourceQuota `cert-manager-quota` удалена (блокировала pods)
   - ClusterIssuer `letsencrypt-prod` создан

2. **1OTC SSL сертификат** получен
   - Certificate `canton-otc-tls-single` для `1otc.cc` - **Ready**
   - Аннотация `cert-manager.io/cluster-issuer` удалена из Ingress (предотвращает автопересоздание)

3. **Multi-swarm** исправлен
   - Service `multi-swarm-system-prod-service` создан (selector: `app=multi-swarm-system`, port: 80→80)
   - Аннотация Ingress исправлена на `letsencrypt-prod`
   - Certificate `multi-swarm-system-prod-tls` - **Ready**

4. **ConfigMap права** для 1OTC исправлены
   - Role `canton-otc-configmap-reader` создана
   - RoleBinding создана

---

## 📋 КОМАНДЫ ДЛЯ БЫСТРОЙ ПРОВЕРКИ

### Проверка всех проектов

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
echo "=== СТАТУС ВСЕХ ПРОЕКТОВ ==="
echo ""
echo "1. 1OTC:"
curl -sI --max-time 10 https://1otc.cc | head -1
echo ""
echo "2. DSP:"
curl -sI --max-time 10 https://gyber.org | head -1
echo ""
echo "3. Maximus:"
curl -sI --max-time 10 https://maximus-marketing-swarm.gyber.org | head -1
echo ""
echo "4. Multi-swarm:"
curl -sI --max-time 10 https://multi-swarm-system.gyber.org | head -1
echo ""
echo "5. Techhy (DNS проблема):"
dig +short techhy.app
EOF
```

### Проверка сертификатов

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
echo "=== CERTIFICATES ==="
kubectl get certificate -A | grep -E 'canton-otc|techhy|dsp|maximus|multi-swarm'
EOF
```

### Проверка подов

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
echo "=== PODS ==="
kubectl get pods -A | grep -E 'canton-otc|techhy|dsp-prod|maximus|multi-swarm' | grep -v Completed
EOF
```

---

## 🔄 ИСПРАВЛЕНИЕ TECHHY (когда DNS исправят)

После того как DNS для techhy.app и techhy.me будут указывать на `31.129.105.180`:

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
# Проверить что DNS обновился
dig +short techhy.app
dig +short techhy.me

# Если DNS правильный - удалить pending challenges и пересоздать certificate
kubectl delete challenge -n techhy-main-production --all
kubectl delete certificate -n techhy-main-production --all

# Certificate должен автоматически пересоздаться из-за аннотации Ingress
# Или создать вручную:
cat <<YAML | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: techhy-main-production-tls
  namespace: techhy-main-production
spec:
  secretName: techhy-main-production-tls
  issuerRef:
    kind: ClusterIssuer
    name: letsencrypt-prod
  dnsNames:
  - techhy.app
  - www.techhy.app
  - techhy.me
  - www.techhy.me
YAML

# Подождать 60 секунд
sleep 60

# Проверить статус
kubectl get certificate -n techhy-main-production
kubectl get challenges -n techhy-main-production
EOF
```

---

## 📝 МАНИФЕСТЫ K8S

### Локальные пути к манифестам

| Проект | Путь |
|--------|------|
| 1OTC | `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/config/kubernetes/k8s/` |
| Techhy | `/Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/k8s/` |
| DSP | `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP/k8s/` |
| Maximus | `/Users/Gyber/GYBERNATY-ECOSYSTEM/maximus/k8s/` |

### 1OTC Манифесты

```
/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/config/kubernetes/k8s/
├── certificate.yaml          # Certificate для SSL
├── clusterissuer.yaml        # ClusterIssuer letsencrypt-prod
├── configmap-rbac.yaml       # RBAC для ConfigMap
├── deployment.yaml           # Deployment
├── ingress.yaml              # Ingress
├── multi-swarm-service.yaml  # Service для multi-swarm (общий)
└── service.yaml              # Service canton-otc
```

---

## 🚨 TROUBLESHOOTING

### Certificate не выдаётся (challenge pending)

1. **Проверить DNS:**
   ```bash
   dig +short DOMAIN
   ```
   Должен возвращать `31.129.105.180`

2. **Проверить solver pods:**
   ```bash
   kubectl get pods -n NAMESPACE | grep cm-acme
   ```

3. **Проверить логи cert-manager:**
   ```bash
   kubectl logs -n cert-manager -l app=cert-manager --tail=100 | grep -i error
   ```

### Multi-swarm 502

1. Проверить selector Service: `app=multi-swarm-system` (НЕ `app=multi-swarm-system-prod`)
2. Проверить targetPort: `80` (НЕ `3000`)
3. Проверить endpoints не пустые

### Ingress автоматически пересоздаёт Certificate

Удалить аннотацию:
```bash
kubectl annotate ingress INGRESS_NAME cert-manager.io/cluster-issuer-
```

---

## 📋 КРАТКИЙ ПРОМПТ ДЛЯ НОВОГО ЧАТА

```
Работа с проектами GYBERNATY ECOSYSTEM.

## Текущий статус
- ✅ 1OTC (https://1otc.cc) - работает
- ✅ DSP (https://gyber.org) - работает  
- ✅ Maximus (https://maximus-marketing-swarm.gyber.org) - работает
- ✅ Multi-swarm (https://multi-swarm-system.gyber.org) - работает
- ⚠️ Techhy - DNS не на кластере (techhy.app → 45.9.41.209, нужно 31.129.105.180)

## SSH
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

## Локальные пути
- 1OTC: /Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc/
- Techhy: /Users/Gyber/GYBERNATY-ECOSYSTEM/tech-hy-ecosystem/
- DSP: /Users/Gyber/GYBERNATY-ECOSYSTEM/DSP/
- Maximus: /Users/Gyber/GYBERNATY-ECOSYSTEM/maximus/
- Multi-swarm: /Users/Gyber/GYBERNATY-ECOSYSTEM/multi-swarm-system/

## Задачи
1. Исправить DNS для Techhy (techhy.app, techhy.me → 31.129.105.180)
2. Когда DNS обновится - пересоздать Certificate
3. Позже: добавить cantonotc.com и canton-otc.com в Certificate 1OTC

Прочитай @COMPLETE_FIX_AND_VERIFY_PROMPT.md для полной информации.
```

---

## ✅ КРИТЕРИИ УСПЕХА

### Выполнено:
- [x] 1OTC: HTTPS 200, SSL Let's Encrypt
- [x] DSP: HTTPS 200
- [x] Maximus: HTTPS 200
- [x] Multi-swarm: HTTPS 200, SSL Let's Encrypt
- [x] Cert-Manager: 3 pods Running
- [x] ConfigMap права для 1OTC

### Ожидает DNS исправления:
- [ ] Techhy: HTTPS работает после исправления DNS
- [ ] 1OTC: SSL для всех трёх доменов (после DNS исправления)

---

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

| Файл | Описание |
|------|----------|
| `COMPLETE_FIX_AND_VERIFY_PROMPT.md` | Этот документ |
| `PROJECTS_VERSION_UPDATE_CHECK_REPORT.md` | Детальный отчёт о проверке |
| `FIX_ISSUES_QUICK_START.md` | Краткое руководство |
| `config/kubernetes/k8s/*.yaml` | K8s манифесты 1OTC |

---

**Автор:** Senior DevOps Engineer  
**Дата:** 19 января 2026  
**Версия:** 2.0 (полное обновление с актуальным статусом)
