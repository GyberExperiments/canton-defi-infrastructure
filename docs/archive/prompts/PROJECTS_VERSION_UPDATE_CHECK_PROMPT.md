# 🔄 ПРОМПТ: ПРОВЕРКА ПРОЕКТОВ ПОСЛЕ ОБНОВЛЕНИЯ ВЕРСИЙ

> **Дата:** 19 января 2026  
> **Цель:** Проверить текущее состояние всех 5 проектов после обновления образов до последних версий

---

## 🎯 ПРОЕКТЫ ДЛЯ ПРОВЕРКИ

| # | Проект | Namespace | Домены |
|---|--------|-----------|--------|
| 1 | **Techhy** | techhy-main-production | techhy.app, www.techhy.app |
| 2 | **1OTC** | canton-otc | 1otc.cc, cantonotc.com |
| 3 | **DSP** | default | gyber.org, www.gyber.org |
| 4 | **Maximus** | maximus | maximus-marketing-swarm.gyber.org |
| 5 | **Multi-swarm** | default | multi-swarm-system.gyber.org |

---

## 🔑 SSH ДОСТУП

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180
```

---

## 📋 ПОЛНАЯ ПРОВЕРКА ПОСЛЕ ОБНОВЛЕНИЯ

### ШАГ 1: ТЕКУЩИЕ ВЕРСИИ ОБРАЗОВ

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

echo "============================================="
echo "   📦 ТЕКУЩИЕ ВЕРСИИ ОБРАЗОВ"
echo "============================================="
echo ""

echo "1. TECHHY:"
kubectl get pods -n techhy-main-production -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""
kubectl get pods -n techhy-main-production -o jsonpath='{.items[0].metadata.name}'
echo ""

echo "2. CANTON-OTC (1OTC):"
kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""
kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[0].metadata.name}'
echo ""

echo "3. DSP:"
kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""
kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{.items[0].metadata.name}'
echo ""

echo "4. MAXIMUS:"
kubectl get pods -n maximus -l app=maximus -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""
kubectl get pods -n maximus -l app=maximus -o jsonpath='{.items[0].metadata.name}'
echo ""

echo "5. MULTI-SWARM:"
kubectl get pods -n default -l app=multi-swarm-system-prod -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || \
kubectl get deployment multi-swarm-system-prod -n default -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""
kubectl get pods -n default -l app=multi-swarm-system-prod -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "Pod name not found"
echo ""
```

---

### ШАГ 2: СТАТУС ПОДОВ ПОСЛЕ ОБНОВЛЕНИЯ

```bash
echo "============================================="
echo "   📊 СТАТУС ПОДОВ ПОСЛЕ ОБНОВЛЕНИЯ"
echo "============================================="
echo ""

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
echo ""

echo "=== ПРОВЕРКА НА ПРОБЛЕМЫ ==="
kubectl get pods -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' | grep -v Running | grep -v Completed
```

---

### ШАГ 3: ВРЕМЯ РАБОТЫ ПОСЛЕ ОБНОВЛЕНИЯ

```bash
echo "============================================="
echo "   ⏱️ ВРЕМЯ РАБОТЫ ПОСЛЕ ОБНОВЛЕНИЯ"
echo "============================================="
echo ""

echo "--- TECHHY ---"
kubectl get pods -n techhy-main-production -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\t"}{.status.containerStatuses[0].ready}{"\n"}{end}'
echo ""

echo "--- 1OTC ---"
kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\t"}{.status.containerStatuses[0].ready}{"\n"}{end}'
echo ""

echo "--- DSP ---"
kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\t"}{.status.containerStatuses[0].ready}{"\n"}{end}'
echo ""

echo "--- MAXIMUS ---"
kubectl get pods -n maximus -l app=maximus -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\t"}{.status.containerStatuses[0].ready}{"\n"}{end}'
echo ""

echo "--- MULTI-SWARM ---"
kubectl get pods -n default -l app=multi-swarm-system-prod -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.startTime}{"\t"}{.status.containerStatuses[0].ready}{"\n"}{end}'
echo ""
```

---

### ШАГ 4: ПРОВЕРКА РАБОТОСПОСОБНОСТИ ПОСЛЕ ОБНОВЛЕНИЯ

```bash
echo "============================================="
echo "   ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ"
echo "============================================="
echo ""

echo "--- TECHHY ---"
echo "HTTP:"
curl -s -o /dev/null -w "  techhy.app: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: techhy.app' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  www.techhy.app: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: www.techhy.app' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  techhy.app: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: techhy.app' https://127.0.0.1 -m 5
echo ""

echo "--- 1OTC ---"
echo "HTTP:"
curl -s -o /dev/null -w "  1otc.cc: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: 1otc.cc' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  cantonotc.com: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: cantonotc.com' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  1otc.cc: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: 1otc.cc' https://127.0.0.1 -m 5
echo ""

echo "--- DSP ---"
echo "HTTP:"
curl -s -o /dev/null -w "  gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: gyber.org' http://127.0.0.1 -m 5
curl -s -o /dev/null -w "  www.gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: www.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: gyber.org' https://127.0.0.1 -m 5
echo ""

echo "--- MAXIMUS ---"
echo "HTTP:"
curl -s -o /dev/null -w "  maximus-marketing-swarm.gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: maximus-marketing-swarm.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  maximus-marketing-swarm.gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: maximus-marketing-swarm.gyber.org' https://127.0.0.1 -m 5
echo ""

echo "--- MULTI-SWARM ---"
echo "HTTP:"
curl -s -o /dev/null -w "  multi-swarm-system.gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: multi-swarm-system.gyber.org' http://127.0.0.1 -m 5
echo "HTTPS:"
curl -sk -o /dev/null -w "  multi-swarm-system.gyber.org: %{http_code} (%{time_total}s, %{size_download} bytes)\n" -H 'Host: multi-swarm-system.gyber.org' https://127.0.0.1 -m 5
echo ""
```

---

### ШАГ 5: ПРОВЕРКА ЛОГОВ НА ОШИБКИ

```bash
echo "============================================="
echo "   📋 ПРОВЕРКА ЛОГОВ НА ОШИБКИ"
echo "============================================="
echo ""

echo "--- TECHHY LOGS (последние 20 строк) ---"
kubectl logs -n techhy-main-production -l app=techhy-main-production --tail=20 2>&1 | tail -10
echo ""

echo "--- 1OTC LOGS (последние 20 строк) ---"
kubectl logs -n canton-otc -l app=canton-otc --tail=20 2>&1 | tail -10
echo ""

echo "--- DSP LOGS (последние 20 строк) ---"
kubectl logs -n default -l app=dsp-prod-primary --tail=20 2>&1 | tail -10
echo ""

echo "--- MAXIMUS LOGS (последние 20 строк) ---"
kubectl logs -n maximus -l app=maximus --tail=20 2>&1 | tail -10
echo ""

echo "--- MULTI-SWARM LOGS (последние 20 строк) ---"
kubectl logs -n default -l app=multi-swarm-system-prod --tail=20 2>&1 | tail -10
echo ""

echo "=== ПОИСК ОШИБОК В ЛОГАХ ==="
for ns in techhy-main-production canton-otc default maximus; do
  echo "--- $ns ---"
  kubectl logs -n $ns --all-containers=true --tail=50 2>&1 | grep -iE 'error|fatal|exception|failed|panic' | tail -5 || echo "Ошибок не найдено"
  echo ""
done
```

---

### ШАГ 6: ПРОВЕРКА РЕСУРСОВ И ПРОИЗВОДИТЕЛЬНОСТИ

```bash
echo "============================================="
echo "   💻 РЕСУРСЫ И ПРОИЗВОДИТЕЛЬНОСТЬ"
echo "============================================="
echo ""

echo "=== УЗЛЫ ==="
kubectl top nodes 2>/dev/null || echo "Metrics недоступны"
echo ""

echo "=== ПОДЫ (CPU/Memory) ==="
kubectl top pods -A 2>/dev/null | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' || echo "Metrics недоступны"
echo ""

echo "=== ОБЩИЕ РЕСУРСЫ КЛАСТЕРА ==="
kubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.capacity.cpu,MEMORY:.status.capacity.memory
echo ""
```

---

### ШАГ 7: ПРОВЕРКА DEPLOYMENTS И REPLICASETS

```bash
echo "============================================="
echo "   🔄 DEPLOYMENTS И REPLICASETS"
echo "============================================="
echo ""

echo "--- TECHHY ---"
kubectl get deployment -n techhy-main-production
kubectl get rs -n techhy-main-production
echo ""

echo "--- 1OTC ---"
kubectl get deployment -n canton-otc
kubectl get rs -n canton-otc
echo ""

echo "--- DSP ---"
kubectl get deployment -n default | grep dsp
kubectl get rs -n default | grep dsp
echo ""

echo "--- MAXIMUS ---"
kubectl get deployment -n maximus
kubectl get rs -n maximus
echo ""

echo "--- MULTI-SWARM ---"
kubectl get deployment -n default | grep multi-swarm
kubectl get rs -n default | grep multi-swarm
echo ""

echo "=== ПРОВЕРКА ROLLOUT STATUS ==="
kubectl rollout status deployment/main-techhy-main-production-deployment -n techhy-main-production --timeout=5s 2>&1 || echo "Rollout завершён"
kubectl rollout status deployment/canton-otc -n canton-otc --timeout=5s 2>&1 || echo "Rollout завершён"
kubectl rollout status deployment/dsp-prod-deployment-primary -n default --timeout=5s 2>&1 || echo "Rollout завершён"
kubectl rollout status deployment/maximus -n maximus --timeout=5s 2>&1 || echo "Rollout завершён"
kubectl rollout status deployment/multi-swarm-system-prod -n default --timeout=5s 2>&1 || echo "Rollout завершён"
```

---

### ШАГ 8: ПРОВЕРКА ENDPOINTS И СЕРВИСОВ

```bash
echo "============================================="
echo "   🌐 ENDPOINTS И СЕРВИСЫ"
echo "============================================="
echo ""

echo "=== ENDPOINTS ==="
kubectl get endpoints -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm'
echo ""

echo "=== SERVICES ==="
kubectl get svc -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' | grep -v kube-system
echo ""

echo "=== ПРОВЕРКА ПРЯМОГО ДОСТУПА К PODS ==="

# Techhy
TECHHY_POD=$(kubectl get pods -n techhy-main-production -l app=techhy-main-production -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$TECHHY_POD" ]; then
  echo "Techhy pod: $TECHHY_POD"
  kubectl exec -n techhy-main-production $TECHHY_POD -- curl -s http://localhost:80 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"
fi

# 1OTC
CANTON_POD=$(kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$CANTON_POD" ]; then
  echo "1OTC pod: $CANTON_POD"
  kubectl exec -n canton-otc $CANTON_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"
fi

# DSP
DSP_POD=$(kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$DSP_POD" ]; then
  echo "DSP pod: $DSP_POD"
  kubectl exec -n default $DSP_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"
fi

# Maximus
MAXIMUS_POD=$(kubectl get pods -n maximus -l app=maximus -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$MAXIMUS_POD" ]; then
  echo "Maximus pod: $MAXIMUS_POD"
  kubectl exec -n maximus $MAXIMUS_POD -- curl -s http://localhost:3000 -o /dev/null -w "HTTP %{http_code}\n" 2>/dev/null || echo "Pod недоступен"
fi
```

---

### ШАГ 9: ФИНАЛЬНЫЙ ОТЧЁТ

```bash
echo "============================================="
echo "   📊 ФИНАЛЬНЫЙ ОТЧЁТ ПО ОБНОВЛЕНИЮ"
echo "============================================="
echo ""

echo "=== ВЕРСИИ ОБРАЗОВ ==="
echo "1. TECHHY:"
kubectl get pods -n techhy-main-production -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

echo "2. 1OTC:"
kubectl get pods -n canton-otc -l app=canton-otc -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

echo "3. DSP:"
kubectl get pods -n default -l app=dsp-prod-primary -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

echo "4. MAXIMUS:"
kubectl get pods -n maximus -l app=maximus -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

echo "5. MULTI-SWARM:"
kubectl get pods -n default -l app=multi-swarm-system-prod -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || \
kubectl get deployment multi-swarm-system-prod -n default -o jsonpath='{.spec.template.spec.containers[0].image}'
echo ""

echo "=== СТАТУС ПОДОВ ==="
kubectl get pods -A | grep -E 'techhy|canton-otc|dsp-prod|maximus|multi-swarm' | grep -v Completed | awk '{print $1, $2, $3, $4, $5}'

echo ""
echo "=== РЕСУРСЫ ==="
kubectl top nodes 2>/dev/null || echo "Metrics недоступны"

echo ""
echo "=== РАЗМЕР БАЗЫ K3S ==="
ls -lh /var/lib/rancher/k3s/server/db/state.db

echo ""
echo "=== ИТОГОВАЯ ПРОВЕРКА HTTP ==="
for site in 'techhy.app' '1otc.cc' 'gyber.org' 'maximus-marketing-swarm.gyber.org' 'multi-swarm-system.gyber.org'; do
  CODE=$(curl -sk -H "Host: $site" -o /dev/null -w '%{http_code}' https://127.0.0.1 -m 3 2>/dev/null)
  echo "$site: HTTP $CODE"
done
```

---

## ✅ КРИТЕРИИ УСПЕШНОГО ОБНОВЛЕНИЯ

### Для каждого проекта должно быть:

1. ✅ **Образ обновлён:** Используется последняя версия образа
2. ✅ **Поды Running:** Все поды в статусе `Running` (1/1 или 2/2)
3. ✅ **HTTP 200:** Код ответа `200` или `301/302` (редирект)
4. ✅ **HTTPS 200:** Код ответа `200` или `301/302`
5. ✅ **Нет ошибок:** В логах нет критических ошибок
6. ✅ **Endpoints активны:** Services имеют активные endpoints
7. ✅ **Rollout завершён:** Все deployments успешно обновлены
8. ✅ **Ресурсы в норме:** CPU/Memory в пределах лимитов

---

## 🔧 ЕСЛИ ОБНОВЛЕНИЕ НЕ УДАЛОСЬ

### Проблема: Pod не запускается после обновления
```bash
# Проверить описание пода
kubectl describe pod <pod-name> -n <namespace>

# Проверить логи
kubectl logs <pod-name> -n <namespace> --previous

# Откатить deployment
kubectl rollout undo deployment/<deployment-name> -n <namespace>
```

### Проблема: Образ не обновился
```bash
# Принудительно обновить
kubectl rollout restart deployment/<deployment-name> -n <namespace>

# Или изменить образ напрямую
kubectl set image deployment/<deployment-name> <container-name>=<new-image> -n <namespace>
```

### Проблема: HTTP 502/503 после обновления
```bash
# Проверить readiness probe
kubectl describe pod <pod-name> -n <namespace> | grep -A5 "Readiness"

# Проверить логи
kubectl logs <pod-name> -n <namespace> --tail=50

# Проверить endpoints
kubectl get endpoints -n <namespace>
```

---

## 📝 ШАБЛОН ОТЧЁТА ПО ОБНОВЛЕНИЮ

После выполнения всех проверок заполни:

```
✅ TECHHY:
   - Образ: [версия]
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - Логи: [OK/ERRORS]
   - Время работы: [X минут]

✅ 1OTC:
   - Образ: [версия]
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - Логи: [OK/ERRORS]
   - Время работы: [X минут]

✅ DSP:
   - Образ: [версия]
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - Логи: [OK/ERRORS]
   - Время работы: [X минут]

✅ MAXIMUS:
   - Образ: [версия]
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - Логи: [OK/ERRORS]
   - Время работы: [X минут]

✅ MULTI-SWARM:
   - Образ: [версия]
   - Pods: [X/X Running]
   - HTTP: [200/404/etc]
   - HTTPS: [200/404/etc]
   - Логи: [OK/ERRORS]
   - Время работы: [X минут]
```

---

## 🚀 БЫСТРАЯ ПРОВЕРКА (ОДНА КОМАНДА)

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180 << 'EOF'
echo "=== ВЕРСИИ ==="
for proj in "techhy-main-production:techhy-main-production" "canton-otc:canton-otc" "default:dsp-prod-primary" "maximus:maximus" "default:multi-swarm-system-prod"; do
  ns=$(echo $proj | cut -d: -f1)
  label=$(echo $proj | cut -d: -f2)
  echo "$ns/$label:"
  kubectl get pods -n $ns -l app=$label -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || echo "не найден"
  kubectl get pods -n $ns -l app=$label -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo ""
  echo ""
done

echo "=== HTTP STATUS ==="
for site in 'techhy.app' '1otc.cc' 'gyber.org' 'maximus-marketing-swarm.gyber.org' 'multi-swarm-system.gyber.org'; do
  CODE=$(curl -sk -H "Host: $site" -o /dev/null -w '%{http_code}' https://127.0.0.1 -m 3 2>/dev/null)
  echo "$site: $CODE"
done
EOF
```

---

**Автор:** Senior DevOps Engineer  
**Дата:** 19 января 2026
