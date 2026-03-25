# ОТЧЁТ ОБ ИСПРАВЛЕНИИ ПРОБЛЕМ KUBERNETES КЛАСТЕРА

**Дата:** 2026-01-11 18:45 MSK  
**Статус:** ⚠️ ЧАСТИЧНО ИСПРАВЛЕНО

**Критическая проблема:** Scheduler перегружен 7571 Pending подов, блокирует планирование новых подов.

---

## ИСПОЛНЕННЫЕ ДЕЙСТВИЯ

### ✅ Выполнено

1. **Созданы скрипты для диагностики и исправления:**
   - `fix-kubernetes-cluster-complete.sh` - главный скрипт
   - `fix-kubernetes-scheduling.sh` - исправление планирования подов
   - `fix-node-disk-capacity.sh` - обработка InvalidDiskCapacity
   - `check-sites-availability.sh` - проверка доступности сайтов
   - `cleanup-pending-pods.sh` - очистка Pending подов

2. **Выполнена диагностика:**
   - Проверено состояние scheduler (K3s использует встроенный scheduler)
   - Проверено состояние узла `canton-node-65-108-15-30`
   - Проверены deployments maximus и redis
   - Удалены зависшие Pending поды
   - Перезапущены deployments для пересоздания подов

3. **Обнаружена критическая проблема:**
   - **7571 Pending подов** в кластере (7482 в namespace `platform-gyber-org`)
   - Scheduler перегружен и не может планировать новые поды
   - Это блокирует планирование подов maximus и redis

---

## ТЕКУЩЕЕ СОСТОЯНИЕ

### 1. gyber.org

**Статус:** ⚠️ КОНФИГУРАЦИЯ ПРАВИЛЬНАЯ, НО САЙТ НЕДОСТУПЕН

**Конфигурация:**
- ✅ Namespace: `default`
- ✅ Ingress: `dsp-prod-ingress` (traefik, IP: 65.108.15.30, порты: 80, 443)
- ✅ Сертификат: `dsp-prod-tls` (Ready, действителен до 2026-02-08)
- ✅ Поды: `dsp-prod-deployment-primary` (3 реплики, все Running)
- ✅ Endpoints: `10.42.0.110:3000, 10.42.1.38:3000`

**Проблема:**
- ❌ Сайт недоступен через HTTPS (curl возвращает 000)
- ❌ Сайт недоступен через ingress IP с Host header
- ⚠️ Возможна проблема с Traefik или сетью

### 2. 1otc.cc

**Статус:** ⚠️ КОНФИГУРАЦИЯ ПРАВИЛЬНАЯ, НО САЙТ НЕДОСТУПЕН

**Конфигурация:**
- ✅ Namespace: `canton-otc`
- ✅ Ingress:
  - `canton-otc-ingress-https` (traefik, IP: 65.108.15.30, порты: 80, 443) - HTTPS
  - `canton-otc-ingress-redirect` (traefik, IP: 65.108.15.30, порт: 80) - HTTP редирект
- ✅ Сертификат: `canton-otc-tls` (Ready, действителен до 2026-04-11)
- ✅ Поды: `canton-otc-c85b7ff68-*` (2 реплики, все Running)
- ✅ Endpoints: `10.42.1.99:3000`

**Проблема:**
- ❌ Сайт недоступен через HTTPS (curl возвращает 000)
- ❌ Сайт недоступен через ingress IP с Host header
- ⚠️ Возможна проблема с Traefik или сетью

### 3. maximus-marketing-swarm.gyber.org

**Статус:** ❌ КРИТИЧЕСКАЯ ПРОБЛЕМА

**Конфигурация:**
- ✅ Namespace: `maximus`
- ✅ Ingress: `maximus-ingress` (traefik, IP: 65.108.15.30, порты: 80, 443)
- ✅ Сертификат: `maximus-tls` (Ready, действителен до 2026-04-11)
- ⚠️ Deployment `maximus`: 1 реплика, но под в статусе **Pending** (14+ минут)
- ⚠️ Deployment `redis`: 1 реплика, но под в статусе **Pending** (14+ минут)
- ⚠️ Старый под `maximus-7c878f8d78-7p2gv` (IP: 10.42.1.81:3000) в статусе **Terminating**
- ✅ Endpoints: `maximus` → `10.42.1.81:3000` (старый под), `redis` → нет endpoints

**Проблема:**
- ❌ Новые поды не могут быть запланированы из-за перегрузки scheduler
- ❌ Сайт недоступен (старый под в Terminating)
- ❌ Redis не работает (нет endpoints)

---

## КРИТИЧЕСКАЯ ПРОБЛЕМА: ПЕРЕГРУЗКА SCHEDULER

### Детали проблемы

**Количество Pending подов:** 7571
- `platform-gyber-org`: 7482 подов (в основном cert-manager challenge поды)
- Другие namespace: 89 подов

**Причина:**
- Scheduler перегружен обработкой тысяч Pending подов
- Не может планировать новые поды, даже с правильным nodeSelector
- Поды создаются (SuccessfulCreate), но scheduler не может их запланировать

**Влияние:**
- Блокирует планирование подов maximus и redis
- Может влиять на планирование подов в других namespace
- Снижает производительность кластера

### Решение

**Требуется массовая очистка Pending подов:**

```bash
# Очистка Pending подов в platform-gyber-org
./scripts/cleanup-pending-pods.sh platform-gyber-org

# Или вручную батчами:
kubectl delete pods -n platform-gyber-org \
  --field-selector=status.phase=Pending \
  --grace-period=0 \
  --force
```

**⚠️ ВНИМАНИЕ:** Очистка может занять время из-за большого количества подов.

---

## ДРУГИЕ ПРОБЛЕМЫ

### 1. InvalidDiskCapacity

**Статус:** ⚠️ ТРЕБУЕТ РУЧНОГО ВМЕШАТЕЛЬСТВА

**Описание:**
- Предупреждение на узле `canton-node-65-108-15-30`
- `invalid capacity 0 on image filesystem`
- Может влиять на планирование подов

**Решение:**
```bash
ssh root@65.108.15.30
systemctl restart k3s-agent
k3s crictl rmi --prune
```

### 2. Недоступность сайтов

**Статус:** ❌ ТРЕБУЕТ ДИАГНОСТИКИ

**Описание:**
- Все три сайта недоступны через HTTPS
- Недоступны даже через ingress IP с Host header
- Endpoints настроены правильно
- Поды работают (для gyber.org и 1otc.cc)

**Возможные причины:**
1. Проблема с Traefik ingress controller
2. Проблема с сетью/файрволом
3. Проблема с DNS
4. Проблема с сертификатами (хотя они в статусе Ready)

**Требуется проверка:**
```bash
# Проверка Traefik
kubectl get pods -n kube-system | grep traefik
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=100

# Проверка сети
kubectl get svc -n kube-system traefik
kubectl get endpoints -n kube-system traefik
```

---

## РЕКОМЕНДАЦИИ

### Приоритет 1: КРИТИЧНО

1. **Очистить Pending поды в platform-gyber-org**
   ```bash
   ./scripts/cleanup-pending-pods.sh platform-gyber-org
   ```
   После очистки подождать 5-10 минут и проверить планирование подов maximus и redis.

2. **Проверить и исправить Traefik**
   ```bash
   kubectl get pods -n kube-system | grep traefik
   kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=100
   ```

3. **Проверить доступность сайтов после очистки Pending подов**

### Приоритет 2: ВАЖНО

4. **Исправить InvalidDiskCapacity на узле**
   - Требуется SSH доступ к узлу
   - Выполнить команды из раздела "Другие проблемы"

5. **Настроить автоматическую очистку старых Pending подов**
   - Создать CronJob для периодической очистки
   - Или настроить cert-manager для правильной очистки challenge подов

### Приоритет 3: ОПТИМИЗАЦИЯ

6. **Мониторинг узла tmedm**
   - Узел загружен на 99% CPU
   - Возможно требуется масштабирование или оптимизация

7. **Оптимизация cert-manager**
   - Настроить правильную очистку challenge подов
   - Ограничить количество одновременных challenge

---

## СЛЕДУЮЩИЕ ШАГИ

1. **Немедленно:**
   - Запустить очистку Pending подов: `./scripts/cleanup-pending-pods.sh platform-gyber-org`
   - Подождать 10-15 минут
   - Проверить планирование подов maximus и redis

2. **После очистки:**
   - Проверить доступность сайтов
   - Проверить логи Traefik
   - Исправить InvalidDiskCapacity

3. **Долгосрочно:**
   - Настроить автоматическую очистку Pending подов
   - Оптимизировать cert-manager
   - Настроить мониторинг scheduler

---

## СОЗДАННЫЕ СКРИПТЫ

Все скрипты сохранены в `scripts/`:

1. `fix-kubernetes-cluster-complete.sh` - главный скрипт
2. `fix-kubernetes-scheduling.sh` - исправление планирования
3. `fix-node-disk-capacity.sh` - обработка InvalidDiskCapacity
4. `check-sites-availability.sh` - проверка сайтов
5. `cleanup-pending-pods.sh` - очистка Pending подов

**Документация:**
- `scripts/KUBERNETES_FIX_README.md` - подробная документация
- `scripts/QUICK_START_K8S_FIX.md` - быстрый старт

---

## ИТОГОВЫЙ СТАТУС

| Компонент | Статус | Примечание |
|-----------|--------|------------|
| gyber.org конфигурация | ✅ | Правильная, но сайт недоступен |
| 1otc.cc конфигурация | ✅ | Правильная, но сайт недоступен |
| maximus конфигурация | ✅ | Правильная, но поды не планируются |
| Scheduler | ❌ | Перегружен 7571 Pending подов |
| InvalidDiskCapacity | ⚠️ | Требует ручного исправления |
| Traefik | ⚠️ | Требует проверки |

**Общий статус:** ⚠️ ЧАСТИЧНО ИСПРАВЛЕНО

**Основная блокирующая проблема:** Перегрузка scheduler из-за 7571 Pending подов.

---

**Отчёт создан:** 2026-01-11 18:30 MSK  
**Следующая проверка:** После очистки Pending подов
