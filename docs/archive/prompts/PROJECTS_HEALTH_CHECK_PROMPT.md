# 🔍 ПРОМПТ: ПРОВЕРКА РАБОТОСПОСОБНОСТИ ВСЕХ 5 ПРОЕКТОВ

> **Дата:** 19 января 2026  
> **Цель:** Проверить реальную доступность и работоспособность всех восстановленных проектов

---

## 🎯 ПРОЕКТЫ ДЛЯ ПРОВЕРКИ

| # | Проект | Namespace | Домены | Статус |
|---|--------|-----------|--------|--------|
| 1 | **Techhy** | techhy-main-production | techhy.app, www.techhy.app, techhy.me, www.techhy.me | ⏳ Проверить |
| 2 | **1OTC** | canton-otc | 1otc.cc, cantonotc.com, canton-otc.com | ⏳ Проверить |
| 3 | **DSP** | default | gyber.org, www.gyber.org | ⏳ Проверить |
| 4 | **Maximus** | maximus | maximus-marketing-swarm.gyber.org | ⏳ Проверить |
| 5 | **Multi-swarm** | default | multi-swarm-system.gyber.org | ⏳ Проверить |

---

## 🔑 SSH ДОСТУП

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180
```

---

## 📋 ПОЛНАЯ ПРОВЕРКА ПРОЕКТОВ

### ШАГ 1: ПРОВЕРКА КЛАСТЕРА И ПОДОВ

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# === УЗЛЫ ===
echo "=== УЗЛЫ КЛАСТЕРА ==="
kubectl get nodes -o wide

# === РЕСУРСЫ ===
echo ""
echo "=== РЕСУРСЫ УЗЛОВ ==="
kubectl top nodes 2>/dev/null || echo "Metrics loading..."

# === ПОДЫ ПРОЕКТОВ ===
echo ""
echo "=== ПОДЫ ПРОЕКТОВ ==="
echo "--- TECHHY ---"
kubectl get pods -n techhy-main-production -o wide

echo ""
echo "--- 1OTC (CANTON-OTC) ---"
kubectl get pods -n canton-otc -o wide

echo ""
echo "--- DSP ---"
kubectl get pods -n default -l app=dsp-prod-primary -o wide

echo ""
echo "--- MAXIMUS ---"
kubectl get pods -n maximus -o wide

echo ""
echo "--- MULTI-SWARM ---"
kubectl get pods -n default -l app=multi-swarm-system-prod -o wide

# === SERVICES ===
echo ""
echo "=== SERVICES ==="
kubectl get svc -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' | grep -v kube-system

# === INGRESS ===
echo ""
echo "=== INGRESS ==="
kubectl get ingress -A | grep -E 'techhy|1otc|canton|gyber|dsp|maximus|multi-swarm'
```

---

### ШАГ 2: ПРОВЕРКА ЧЕРЕЗ HTTP/HTTPS (НА СЕРВЕРЕ)

```bash
# Проверка через localhost с Host headers
echo "=== ПРОВЕРКА HTTP/HTTPS НА СЕРВЕРЕ ==="
echo ""

echo "--- TECHHY ---"
echo "HTTP:"
curl -s -o /dev/null -w "  techhy.app: %{http_code} (%{time_total}s)\n" -H 'Host: techhy.app' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  www.techhy.app: %{http_code} (%{time_total}s)\n" -H 'Host: www.techhy.app' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  techhy.app: %{http_code} (%{time_total}s)\n" -H 'Host: techhy.app' https://127.0.0.1 -m 5
curl -sk -o /dev/null -w "  www.techhy.app: %{http_code} (%{time_total}s)\n" -H 'Host: www.techhy.app' https://127.0.0.1 -m 5

echo ""
echo "--- 1OTC ---"
echo "HTTP:"
curl -s -o /dev/null -w "  1otc.cc: %{http_code} (%{time_total}s)\n" -H 'Host: 1otc.cc' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  cantonotc.com: %{http_code} (%{time_total}s)\n" -H 'Host: cantonotc.com' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  1otc.cc: %{http_code} (%{time_total}s)\n" -H 'Host: 1otc.cc' https://127.0.0.1 -m 5
curl -sk -o /dev/null -w "  cantonotc.com: %{http_code} (%{time_total}s)\n" -H 'Host: cantonotc.com' https://127.0.0.1 -m 5

echo ""
echo "--- DSP ---"
echo "HTTP:"
curl -s -o /dev/null -w "  gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: gyber.org' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  www.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: www.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: gyber.org' https://127.0.0.1 -m 5
curl -sk -o /dev/null -w "  www.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: www.gyber.org' https://127.0.0.1 -m 5

echo ""
echo "--- MAXIMUS ---"
echo "HTTP:"
curl -s -o /dev/null -w "  maximus-marketing-swarm.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: maximus-marketing-swarm.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  maximus-marketing-swarm.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: maximus-marketing-swarm.gyber.org' https://127.0.0.1 -m 5

echo ""
echo "--- MULTI-SWARM ---"
echo "HTTP:"
curl -s -o /dev/null -w "  multi-swarm-system.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: multi-swarm-system.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  multi-swarm-system.gyber.org: %{http_code} (%{time_total}s)\n" -H 'Host: multi-swarm-system.gyber.org' https://127.0.0.1 -m 5
```

---

### ШАГ 3: ПРОВЕРКА ЧЕРЕЗ РЕАЛЬНЫЕ ДОМЕНЫ (С ЛОКАЛЬНОЙ МАШИНЫ)

```bash
# На локальной машине (Mac)
echo "=== ПРОВЕРКА DNS ==="
echo "techhy.app:"
dig +short techhy.app @8.8.8.8
echo "1otc.cc:"
dig +short 1otc.cc @8.8.8.8
echo "gyber.org:"
dig +short gyber.org @8.8.8.8

echo ""
echo "=== ПРОВЕРКА ЧЕРЕЗ РЕАЛЬНЫЕ ДОМЕНЫ ==="
echo ""

echo "--- TECHHY ---"
curl -I https://techhy.app 2>&1 | head -5
curl -I https://www.techhy.app 2>&1 | head -5

echo ""
echo "--- 1OTC ---"
curl -I https://1otc.cc 2>&1 | head -5
curl -I https://cantonotc.com 2>&1 | head -5

echo ""
echo "--- DSP ---"
curl -I https://gyber.org 2>&1 | head -5
curl -I https://www.gyber.org 2>&1 | head -5

echo ""
echo "--- MAXIMUS ---"
curl -I https://maximus-marketing-swarm.gyber.org 2>&1 | head -5

echo ""
echo "--- MULTI-SWARM ---"
curl -I https://multi-swarm-system.gyber.org 2>&1 | head -5
```

---

### ШАГ 4: ПРОВЕРКА ЛОГОВ И ОШИБОК

```bash
# На сервере
echo "=== ПРОВЕРКА ЛОГОВ ==="

echo "--- TECHHY LOGS (последние 10 строк) ---"
kubectl logs -n techhy-main-production -l app=techhy-main-production --tail=10 2>&1 | tail -5

echo ""
echo "--- 1OTC LOGS (последние 10 строк) ---"
kubectl logs -n canton-otc -l app=canton-otc --tail=10 2>&1 | tail -5

echo ""
echo "--- DSP LOGS (последние 10 строк) ---"
kubectl logs -n default -l app=dsp-prod-primary --tail=10 2>&1 | tail -5

echo ""
echo "--- MAXIMUS LOGS (последние 10 строк) ---"
kubectl logs -n maximus -l app=maximus --tail=10 2>&1 | tail -5

echo ""
echo "--- MULTI-SWARM LOGS (последние 10 строк) ---"
kubectl logs -n default -l app=multi-swarm-system-prod --tail=10 2>&1 | tail -5

echo ""
echo "=== ПРОВЕРКА ОШИБОК В ПОДАХ ==="
kubectl get pods -A | grep -v Running | grep -v Completed | grep -v Terminating
```

---

### ШАГ 5: ПРОВЕРКА ENDPOINTS И СЕРВИСОВ

```bash
# На сервере
echo "=== ПРОВЕРКА ENDPOINTS ==="
kubectl get endpoints -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm'

echo ""
echo "=== ПРОВЕРКА ПРЯМОГО ДОСТУПА К PODS ==="

# Techhy
TECHHY_POD=$(kubectl get pods -n techhy-main-production -l app=techhy-main-production -o jsonpath='{.items[0].metadata.name}')
echo "Techhy pod: $TECHHY_POD"
kubectl exec -n techhy-main-production $TECHHY_POD -- curl -s http://localhost:80 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"

# 1OTC
CANTON_POD=$(kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[0].metadata.name}')
echo "1OTC pod: $CANTON_POD"
kubectl exec -n canton-otc $CANTON_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"

# DSP
DSP_POD=$(kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{.items[0].metadata.name}')
echo "DSP pod: $DSP_POD"
kubectl exec -n default $DSP_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"

# Maximus
MAXIMUS_POD=$(kubectl get pods -n maximus -l app=maximus -o jsonpath='{.items[0].metadata.name}')
echo "Maximus pod: $MAXIMUS_POD"
kubectl exec -n maximus $MAXIMUS_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"
```

---

### ШАГ 6: ФИНАЛЬНЫЙ ОТЧЁТ

```bash
# На сервере
echo "============================================="
echo "   📊 ФИНАЛЬНЫЙ ОТЧЁТ О РАБОТОСПОСОБНОСТИ"
echo "============================================="
echo ""

echo "=== СТАТУС ПОДОВ ==="
kubectl get pods -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' | grep -v Completed | awk '{print $1, $2, $3, $4}'

echo ""
echo "=== РЕСУРСЫ ==="
kubectl top nodes 2>/dev/null || echo "Metrics недоступны"

echo ""
echo "=== РАЗМЕР БАЗЫ K3S ==="
ls -lh /var/lib/rancher/k3s/server/db/state.db

echo ""
echo "=== TRAEFIK STATUS ==="
kubectl get pods -n kube-system | grep traefik

echo ""
echo "=== ИНГРЕССЫ ==="
kubectl get ingress -A | grep -E 'techhy|1otc|canton|gyber|dsp|maximus|multi-swarm' | awk '{print $1, $2, $4, $5}'
```

---

## ✅ КРИТЕРИИ УСПЕШНОЙ ПРОВЕРКИ

### Для каждого проекта должно быть:

1. ✅ **Поды:** Все поды в статусе `Running` (1/1 или 2/2)
2. ✅ **HTTP:** Код ответа `200` или `301/302` (редирект)
3. ✅ **HTTPS:** Код ответа `200` или `301/302`
4. ✅ **DNS:** Домены резолвятся в `31.129.105.180`
5. ✅ **Endpoints:** Services имеют активные endpoints
6. ✅ **Логи:** Нет критических ошибок в логах

---

## 🔧 ЕСЛИ ЧТО-ТО НЕ РАБОТАЕТ

### Проблема: Pod не запускается
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Проблема: HTTP 404
```bash
# Проверить ingress
kubectl get ingress -n <namespace>
kubectl describe ingress <ingress-name> -n <namespace>

# Проверить service
kubectl get svc -n <namespace>
kubectl get endpoints -n <namespace>
```

### Проблема: DNS не резолвится
```bash
# Проверить DNS записи
dig +short <domain> @8.8.8.8

# Если не резолвится - обновить DNS записи в панели провайдера
```

### Проблема: Traefik не работает
```bash
kubectl logs -n kube-system deployment/traefik --tail=50
kubectl get pods -n kube-system | grep traefik
```

---

## 📝 ШАБЛОН ОТЧЁТА

После выполнения всех проверок заполни:

```
✅ TECHHY:
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - DNS: [OK/FAIL]
   - Логи: [OK/ERRORS]

✅ 1OTC:
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - DNS: [OK/FAIL]
   - Логи: [OK/ERRORS]

✅ DSP:
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - DNS: [OK/FAIL]
   - Логи: [OK/ERRORS]

✅ MAXIMUS:
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - DNS: [OK/FAIL]
   - Логи: [OK/ERRORS]

✅ MULTI-SWARM:
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - DNS: [OK/FAIL]
   - Логи: [OK/ERRORS]
```

---

**Автор:** Senior DevOps Engineer  
**Дата:** 19 января 2026
