# 🟢 K3S КЛАСТЕР ВОССТАНОВЛЕН — DNS ТРЕБУЕТ ОБНОВЛЕНИЯ

> **Версия:** 6.0 | **Дата:** 18 января 2026, 03:50 UTC  
> **Статус:** ✅ КЛАСТЕР РАБОТАЕТ | ⚠️ DNS ТРЕБУЕТ ОБНОВЛЕНИЯ  
> **Диск:** 23% | **CPU:** 4% | **Memory:** 25%

---

## 🎯 ТЕКУЩИЙ СТАТУС

### ✅ КЛАСТЕР ПОЛНОСТЬЮ ВОССТАНОВЛЕН:

| Метрика | БЫЛО | СТАЛО |
|---------|------|-------|
| **База SQLite** | 24 GB | **10 MB** |
| **CPU** | 99% | **4%** |
| **Memory** | 99% | **25%** |
| **Disk** | 91% | **23%** |
| **k3s** | зависал | **Running** |

### ✅ ВСЕ ПРОЕКТЫ РАБОТАЮТ (проверено через IP):

| Проект | Namespace | HTTP через IP | Pods |
|--------|-----------|---------------|------|
| **Techhy** | techhy-main-production | 200 ✅ | 2/2 |
| **1OTC** | canton-otc | 200 ✅ | 2/2 |
| **DSP** | default | 200 ✅ | 3/3 |
| **Maximus** | maximus | 200 ✅ | 1/1 |
| **Multi-swarm** | default | 200 ✅ | 3/3 |

---

## 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: DNS

**Домены указывают на СТАРЫЕ IP адреса!**

| Домен | Текущий DNS IP | Должен быть |
|-------|----------------|-------------|
| techhy.app | 45.9.41.209 ❌ | **31.129.105.180** |
| 1otc.cc | 46.173.18.60 ❌ | **31.129.105.180** |
| gyber.org | 45.9.41.209 ❌ | **31.129.105.180** |
| maximus-marketing-swarm.gyber.org | 45.9.41.209 ❌ | **31.129.105.180** |

### DNS Провайдеры:

| Домены | Провайдер | Панель управления |
|--------|-----------|-------------------|
| techhy.app, 1otc.cc | Namecheap | https://namecheap.com |
| gyber.org | Beget | https://beget.com |

---

## ✅ ИНСТРУКЦИЯ ПО ОБНОВЛЕНИЮ DNS

### Namecheap (techhy.app, 1otc.cc):

1. Войти на https://namecheap.com
2. Domain List → выбрать домен → **Advanced DNS**
3. Изменить **A Records**:

```
Host          Type    Value              TTL
@             A       31.129.105.180     300
www           A       31.129.105.180     300
```

### Beget (gyber.org):

1. Войти на https://beget.com
2. Домены → gyber.org → **DNS записи**
3. Изменить **A Records**:

```
Host                          Type    Value              TTL
@                             A       31.129.105.180     300
www                           A       31.129.105.180     300
maximus-marketing-swarm       A       31.129.105.180     300
multi-swarm-system            A       31.129.105.180     300
```

---

## 🔍 ПРОВЕРКА ПОСЛЕ ОБНОВЛЕНИЯ DNS

```bash
# Проверить DNS
dig +short techhy.app
dig +short 1otc.cc
dig +short gyber.org
# Все должны вернуть: 31.129.105.180

# Проверить сайты
curl -I https://techhy.app 2>&1 | head -3
curl -I https://1otc.cc 2>&1 | head -3
curl -I https://gyber.org 2>&1 | head -3
```

---

## 🔑 SSH ДОСТУП

```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180
```

---

## 📊 ДИАГНОСТИКА КЛАСТЕРА

```bash
# Статус узлов
kubectl get nodes
kubectl top nodes

# Все поды
kubectl get pods -A | grep -v kube-system | grep -v Completed

# Размер базы
ls -lh /var/lib/rancher/k3s/server/db/state.db

# Ingress
kubectl get ingress -A
```

---

## ✅ ВЫПОЛНЕННЫЕ ДЕЙСТВИЯ

### Восстановление кластера:
- [x] Радикальное решение: переименована старая база 24GB
- [x] k3s перезапущен с чистой базой
- [x] Все namespaces созданы
- [x] Secrets применены
- [x] ConfigMaps применены
- [x] Deployments созданы
- [x] Services настроены с правильными selectors и портами
- [x] Ingress применены
- [x] Удалены проблемные annotations (router.tls)
- [x] Удалены конфликтующие ACME solver ingress
- [x] Auradomus отключен

### Prevention настроен:
- [x] Cron для очистки events каждые 2 часа
- [x] Мониторинг размера базы
- [x] cert-manager ResourceQuota (max 10 pods)

---

## 🛡️ BEST PRACTICES (ПРИМЕНЕНО)

### 1. Events cleanup cron:
```bash
# Каждые 2 часа
0 */2 * * * kubectl delete events -A --all
```

### 2. cert-manager limits:
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: cert-manager-quota
  namespace: cert-manager
spec:
  hard:
    pods: "10"
    requests.cpu: "500m"
    requests.memory: "512Mi"
```

### 3. DB monitoring:
```bash
# /etc/cron.daily/k3s-db-monitor
SIZE=$(du -sm /var/lib/rancher/k3s/server/db/state.db | cut -f1)
[ "$SIZE" -gt 500 ] && echo "WARNING: k3s DB is ${SIZE}MB" | logger
```

---

## 📋 ЧЕКЛИСТ ДЛЯ ЗАВЕРШЕНИЯ

### Кластер (DONE):
- [x] k3s работает
- [x] Все проекты запущены
- [x] Ingress настроены
- [x] Services работают

### DNS (ТРЕБУЕТСЯ):
- [ ] Обновить A-записи techhy.app → 31.129.105.180
- [ ] Обновить A-записи 1otc.cc → 31.129.105.180  
- [ ] Обновить A-записи gyber.org → 31.129.105.180
- [ ] Дождаться propagation (5-30 минут)
- [ ] Проверить доступность сайтов через браузер

---

## 🔗 ССЫЛКИ (после обновления DNS)

- 🌐 **Techhy:** https://techhy.app
- 🌐 **1OTC:** https://1otc.cc
- 🌐 **DSP:** https://gyber.org
- 🌐 **Maximus:** https://maximus-marketing-swarm.gyber.org
- 🌐 **Multi-swarm:** https://multi-swarm-system.gyber.org

---

## 📞 ЭКСТРЕННЫЕ КОМАНДЫ

### Если что-то сломалось:
```bash
ssh -i ~/.ssh/id_rsa_canton root@31.129.105.180

# Перезапуск traefik
kubectl rollout restart deployment traefik -n kube-system

# Статус подов
kubectl get pods -A | grep -v Running | grep -v Completed

# Логи проекта
kubectl logs -n canton-otc deployment/canton-otc --tail=50
kubectl logs -n techhy-main-production deployment/main-techhy-main-production-deployment --tail=50
```

---

**Автор:** Senior DevOps Engineer  
**Версия:** 6.0  
**Дата:** 18 января 2026, 03:50 UTC

### Changelog v6.0:
- ✅ Кластер полностью восстановлен
- ✅ Все проекты работают (проверено через IP)
- ⚠️ Выявлена проблема DNS — записи указывают на старые IP
- 📝 Добавлена инструкция по обновлению DNS
- 📝 Добавлены команды проверки после обновления
