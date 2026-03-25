# 📊 ОТЧЁТ О ВОССТАНОВЛЕНИИ КЛАСТЕРА K3S

**Дата:** 18 января 2026  
**Статус:** В ПРОЦЕССЕ - требуется продолжение  
**Сессия:** Частичное восстановление выполнено

---

## ✅ ВЫПОЛНЕННЫЕ ДЕЙСТВИЯ

### ЭТАП 1: Остановка источников нагрузки ✅
| Действие | Статус |
|----------|--------|
| Остановка cert-manager | ✅ Выполнено |
| Остановка maximus/redis | ✅ Выполнено (replicas=0) |
| Остановка canton-otc-minimal-stage | ✅ Выполнено |
| Остановка canton-otc-stage | ✅ Выполнено |
| Остановка coingecko-scanner | ✅ Выполнено |
| Остановка cryptorecovery | ✅ Выполнено |
| Остановка develop-pswmeta (все) | ✅ Выполнено |
| Остановка external-secrets | ✅ Выполнено |
| Остановка gitlab | ✅ Выполнено |
| Остановка istio мониторинга | ✅ Выполнено (grafana, kiali, prometheus) |
| Остановка metallb controller | ✅ Выполнено |
| Остановка stage-pswmeta (все) | ✅ Выполнено |

### ЭТАП 2: Удаление NotReady узла ✅
| Действие | Статус |
|----------|--------|
| Удаление подов с узла | ✅ Выполнено |
| Удаление узла canton-node-65-108-15-30 | ✅ Выполнено |

### ЭТАП 3: Очистка ресурсов ✅
| Действие | Статус |
|----------|--------|
| Удаление Challenges | ✅ Выполнено (несколько раз) |
| Удаление Orders | ✅ Выполнено |
| Удаление CertificateRequests | ✅ Выполнено |
| Очистка Pending подов maximus | ✅ Выполнено |
| Очистка Pending подов kube-system | ✅ Выполнено |
| Очистка других namespaces | ✅ Выполнено |

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ КЛАСТЕРА

### Узлы:
```
NAME         STATUS   ROLES                  AGE    VERSION
kczdjomrqi   Ready    worker                 201d   v1.31.5+k3s1
tmedm        Ready    control-plane,master   148d   v1.31.4+k3s1
upbewhtibq   Ready    <none>                 198d   v1.32.5+k3s1
```
✅ Узел canton-node-65-108-15-30 успешно удалён

### Нагрузка:
```
NAME         CPU(cores)   CPU%    MEMORY
kczdjomrqi   174m         8%      1642Mi (41%)
tmedm        3998m        99%     5409Mi (68%)  ⚠️ ВСЁ ЕЩЁ ВЫСОКАЯ!
upbewhtibq   109m         3%      1830Mi (37%)
```

### ⚠️ ПРОБЛЕМА: CPU control-plane всё ещё 99%!

**Причина:** Несмотря на остановку deployments, есть другие источники нагрузки:
1. etcd обработка накопившихся объектов
2. Оставшиеся deployments с DESIRED > READY продолжают создавать scheduler events
3. Cert-manager challenges продолжают появляться (что-то их создаёт)

---

## ⚠️ ОСТАВШИЕСЯ ПРОБЛЕМЫ

### 1. Traefik НЕ РАБОТАЕТ (КРИТИЧНО!)
```
kube-system   traefik   0/1   1   0   376d
```
**Влияние:** ВСЕ сайты недоступны извне - ingress не работает

### 2. Проблемные Deployments (DESIRED > READY)
| Namespace | Deployment | Ready | Проблема |
|-----------|------------|-------|----------|
| kube-system | traefik | 0/1 | КРИТИЧНО! Ingress не работает |
| canton-otc | canton-otc | 1/2 | Одна реплика не запускается |
| default | auradomus-deployment | 2/3 | Одна реплика не запускается |
| default | dsp-prod-deployment-primary | 2/3 | Одна реплика не запускается |
| default | dsp-stage-deployment | 1/2 | Одна реплика не запускается |
| default | multi-swarm-system-prod | 2/3 | Одна реплика не запускается |
| supabase | oidc-provider, auth, jwks, meta, realtime, rest | 0/1, 0/2 | Не запускаются |
| supabase-stage | auth, kong, realtime | 0/1 | Не запускаются |

### 3. CPU control-plane 99%
- Возможно etcd переполнен events
- Возможно есть другие контроллеры генерирующие нагрузку

### 4. Challenges продолжают появляться
- Cert-manager остановлен, но challenges создаются
- Возможно есть другой controller или webhook

---

## 🎯 РЕКОМЕНДАЦИИ ДЛЯ ПРОДОЛЖЕНИЯ

### НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ:

1. **Уменьшить replicas для всех deployment с проблемами до 1**
   ```bash
   kubectl scale deployment canton-otc -n canton-otc --replicas=1
   kubectl scale deployment auradomus-deployment -n default --replicas=1
   kubectl scale deployment dsp-prod-deployment-primary -n default --replicas=1
   kubectl scale deployment dsp-stage-deployment -n default --replicas=1
   kubectl scale deployment multi-swarm-system-prod -n default --replicas=1
   ```

2. **Остановить все supabase deployments**
   ```bash
   kubectl scale deployment --all -n supabase --replicas=0
   kubectl scale deployment --all -n supabase-stage --replicas=0
   ```

3. **Восстановить Traefik** (после стабилизации CPU)
   ```bash
   kubectl scale deployment traefik -n kube-system --replicas=1
   ```

4. **Очистить старые events из etcd** (если CPU не падает)
   - SSH на control-plane
   - Очистить old events: `kubectl delete events -A --field-selector reason=FailedScheduling`

5. **Перезапустить k3s** (крайняя мера если CPU не падает)
   ```bash
   ssh root@tmedm "systemctl restart k3s"
   ```

---

## 📋 ЧЕКЛИСТ ДЛЯ ЗАВЕРШЕНИЯ

- [ ] CPU tmedm < 50%
- [ ] Traefik 1/1 Running
- [ ] cert-manager настроен с max-concurrent-challenges=5
- [ ] canton-otc работает (1/1 или 2/2)
- [ ] Сайты gyber.org, 1otc.cc доступны
- [ ] Нет Challenges в кластере при остановленном cert-manager
- [ ] Нет Pending подов (< 5)

---

**Автор:** AI DevOps  
**Версия:** 1.0
