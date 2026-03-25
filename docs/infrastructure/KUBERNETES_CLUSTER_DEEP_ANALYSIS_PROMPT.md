# 🔍 ГЛОБАЛЬНЫЙ АНАЛИЗ И ВОССТАНОВЛЕНИЕ KUBERNETES КЛАСТЕРА

## ⚡ КРАТКАЯ СВОДКА СИТУАЦИИ

**КРИТИЧЕСКОЕ СОСТОЯНИЕ КЛАСТЕРА:**
- 🚨 Control-plane узел перегружен на **99% CPU** - scheduler не может эффективно работать
- 🚨 **~15,091 проблемных подов** vs только **65 Running** - соотношение 232:1
- 🚨 **7,427 Pending подов** только в одном namespace (cert-manager challenges)
- 🚨 Узел `canton-node-65-108-15-30` отключен, но поды на нем зависли в Terminating
- ⚠️ Redis для maximus не может быть запланирован (0/1 ready)

**ЧТО НУЖНО:**
1. Снизить нагрузку на control-plane (найти и устранить причину 99% CPU)
2. Очистить массу Pending подов (особенно cert-manager challenges)
3. Исправить проблемы с cert-manager (таймауты challenges)
4. Принудительно удалить зависшие поды на отключенном узле
5. Восстановить работу проектов (maximus, gyber.org, 1otc.cc)

**ПОДХОД:** Глобальный системный анализ, поиск корневых причин, а не удаление симптомов.

---

## 🎯 ЦЕЛЬ
Провести глубокий анализ состояния Kubernetes кластера (K3s), выявить все критические проблемы, которые мешают запуску необходимых проектов, найти корневые причины и восстановить корректное состояние кластера.

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ КЛАСТЕРА

### Узлы кластера:
```
NAME                       STATUS                        ROLES                  AGE    VERSION
canton-node-65-108-15-30   NotReady,SchedulingDisabled   <none>                 61d    v1.33.6+k3s1  ⚠️ ОТКЛЮЧЕН
kczdjomrqi                 Ready                         worker                 195d   v1.31.5+k3s1
tmedm                      Ready                         control-plane,master   142d   v1.31.4+k3s1  ⚠️ ПЕРЕГРУЖЕН (99% CPU)
upbewhtibq                 Ready                         <none>                 192d   v1.32.5+k3s1
```

### Использование ресурсов узлов:
```
NAME                       CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
kczdjomrqi                 147m         7%       1748Mi          44%
tmedm                      3996m        99%     4665Mi          58%  ⚠️ КРИТИЧЕСКАЯ ПЕРЕГРУЗКА
upbewhtibq                 121m         4%       1897Mi          38%
canton-node-65-108-15-30   <unknown>    <unknown> <unknown>      <unknown>  ⚠️ НЕДОСТУПЕН
```

### Масштаб проблем:
- **~15,091 проблемных подов** (Pending/CrashLoopBackOff/Error/Terminating)
- **7,427 Pending подов** только в namespace `platform-gyber-org` (cert-manager challenges)
- **Только 65 Running подов** во всем кластере (33 namespace)
- **Множество зависших подов** в статусе Terminating на отключенном узле
- **Критическая перегрузка control-plane узла** (99% CPU)

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. ПЕРЕГРУЗКА CONTROL-PLANE УЗЛА (tmedm)
**Симптомы:**
- CPU загрузка: **99%**
- Memory: 58%
- Узел выполняет роль control-plane и master

**Влияние:**
- Scheduler перегружен и не может эффективно планировать поды
- API server может отвечать с задержками
- Общая деградация производительности кластера

**Требуется анализ:**
- Какие процессы/поды потребляют CPU на control-plane?
- Можно ли перенести часть нагрузки на worker узлы?
- Нужно ли масштабирование или оптимизация?

### 2. МАССИВНОЕ КОЛИЧЕСТВО PENDING ПОДОВ
**Масштаб:**
- **~15,091 проблемных подов** в кластере
- **7,427 Pending подов** только в namespace `platform-gyber-org` (cert-manager challenges)
- **Только 65 Running подов** во всем кластере (при 33 namespace!)
- Соотношение проблемных/рабочих подов: **~232:1** - критическая ситуация

**Причины:**
- Scheduler перегружен из-за огромного количества Pending подов
- Cert-manager создает тысячи challenge подов, которые не могут быть запланированы
- Старые Pending поды накапливаются и блокируют планирование новых

**Влияние:**
- Scheduler не может эффективно работать
- Новые поды не могут быть запланированы
- Ресурсы кластера тратятся на обработку неактуальных объектов

**Требуется:**
- Очистка старых Pending подов (особенно cert-manager challenges)
- Анализ причин создания такого количества challenge подов
- Оптимизация cert-manager конфигурации

### 3. ПРОБЛЕМЫ С CERT-MANAGER
**Симптомы:**
- Множество ошибок: `PresentError: Error presenting challenge: Timeout`
- Поды cert-manager с ошибками: `FailedMount: failed to fetch token: pods not found`
- Тысячи зависших challenge подов

**Влияние:**
- Сертификаты не могут быть выпущены/обновлены
- Ingress может не работать корректно
- Блокирует планирование других подов

**КОРНЕВАЯ ПРИЧИНА (НАЙДЕНА):**
- Cert-manager создавал Challenge поды для ingress, которые используют несуществующие ingress controllers (Istio, Nginx)
- Challenge поды не могли быть запланированы (нет подходящего ingress controller)
- Cert-manager продолжал создавать новые Challenge, старые не удалялись
- Нет ограничений на количество одновременных Challenge (`--max-concurrent-challenges`)
- Нет автоматической очистки solver подов (`--acme-http01-solver-pod-grace-period`)

**РЕШЕНИЕ:**
- ✅ Cert-manager остановлен
- ✅ Проблемные ingress удалены
- ⏳ Нужно настроить правильную конфигурацию перед перезапуском

### 4. ЗАВИСШИЕ ПОДЫ НА ОТКЛЮЧЕННОМ УЗЛЕ
**Симптомы:**
- Узел `canton-node-65-108-15-30` в статусе NotReady
- Узел помечен как SchedulingDisabled (cordoned)
- Поды на узле зависли в статусе Terminating

**Влияние:**
- Ресурсы узла недоступны
- Поды не могут быть удалены нормальным образом
- Блокирует создание новых подов для deployments

**Требуется:**
- Принудительное удаление зависших подов
- Очистка finalizers
- Возможно, полное удаление узла из кластера

### 5. ПРОБЛЕМЫ С ПРОЕКТАМИ

#### maximus-marketing-swarm.gyber.org
**Текущее состояние:**
- Deployment maximus: 1/1 replicas, 1 ready, 1 available (✅ работает)
- Deployment redis: 1/1 replicas, 0 ready, 0 available (❌ не может быть запланирован)
- Старые поды в Terminating на отключенном узле
- Новые поды redis не могут быть запланированы из-за перегрузки scheduler
- Ingress настроен: `maximus-ingress` (traefik, IP: 65.108.15.30)
- Сертификат: `maximus-tls` (Ready, действителен до 2026-04-11)

**Требуется:**
- Очистка старых подов
- Перезапуск deployments
- Проверка планирования на других узлах

#### gyber.org и 1otc.cc
**Статус:** Требуется проверка доступности после исправления основных проблем

## 🔄 ПРОГРЕСС РЕШЕНИЯ (ЧТО УЖЕ СДЕЛАНО)

### ✅ ЭТАП 1: АНАЛИЗ И ДИАГНОСТИКА

1. ✅ **Проведен глобальный анализ всех проектов экосистемы**
   - Проанализированы все Kubernetes конфигурации в `/Users/Gyber/GYBERNATY-ECOSYSTEM`
   - Найдены критические противоречия в конфигурациях проектов

2. ✅ **Выявлены корневые причины проблем:**
   - **Конфликт Ingress Controllers:** 11 ingress используют Istio (не установлен), 1 использует Nginx (не установлен)
   - **Разнообразие ClusterIssuer:** 3 разных issuer'а (`letsencrypt-prod`, `letsencrypt-production`, `letsencrypt-staging`)
   - **Автоматическое создание Certificate:** Все ingress с аннотацией создают Certificate, даже для неработающих ingress
   - **Неправильная конфигурация cert-manager:** Нет ограничений на количество Challenge, нет автоочистки

3. ✅ **Создана документация:**
   - `CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md` - полный план восстановления
   - `CLUSTER_ANALYSIS_REPORT.md` - детальный отчет по анализу
   - `scripts/cluster-recovery-critical.sh` - скрипт критического восстановления
   - `scripts/cleanup-simple.sh` - упрощенный скрипт очистки
   - `scripts/cleanup-direct.sh` - прямой скрипт очистки через API

### ✅ ЭТАП 2: КРИТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ

4. ✅ **Остановлен cert-manager**
   - Все компоненты cert-manager остановлены (controller, cainjector, webhook)
   - Прекращено создание новых Challenge подов

5. ✅ **Удалены проблемные Ingress ресурсы:**
   - Удалено 11 ingress с Istio (не установлен в кластере)
   - Удален ingress с Nginx из namespace supabase
   - Удалены все challenge solver ingress

6. ✅ **Удалены проблемные Certificate ресурсы:**
   - Удалено 6 Certificate для Istio ingress
   - Очищены проблемные Certificate из namespace istio-system

7. ✅ **Начата очистка Pending подов:**
   - Удалено ~100+ cert-manager challenge подов (cm-acme-http-solver-*)
   - Удалены старые cronjob поды (cert-monitor, cleanup-old-replicasets)
   - **ПРОБЛЕМА:** API server перегружен (99% CPU), команды таймаутят
   - **СТАТУС:** Очистка продолжается, но медленно из-за перегрузки control-plane

8. ✅ **Исправлены ingress конфигурации в проектах:**
   - `canton-otc/k8s/supabase/ingress.yaml`: nginx → traefik
   - `aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml`: istio → traefik, letsencrypt-production → letsencrypt-prod

### ⚠️ ЭТАП 3: В ПРОЦЕССЕ

9. ⚠️ **Очистка Pending подов (в процессе):**
   - API server перегружен, команды таймаутят
   - Нужно продолжать удаление меньшими батчами
   - Осталось обработать тысячи Pending подов

10. ⏳ **Настройка cert-manager:**
    - Нужно применить правильную конфигурацию (ограничения, автоочистка)
    - Перезапустить cert-manager после очистки

11. ⏳ **Унификация ClusterIssuer:**
    - Обновить все ingress конфигурации на `letsencrypt-prod` или `letsencrypt-staging`
    - Удалить неиспользуемый `letsencrypt-production`

### ❌ НЕ РЕШЕНО

12. ❌ **Зависшие поды в Terminating на отключенном узле**
    - Требуется очистка finalizers

13. ❌ **Перегрузка control-plane узла (99% CPU)**
    - Основная причина: scheduler перегружен из-за тысяч Pending подов
    - Решение: после очистки Pending подов нагрузка должна снизиться

14. ❌ **Восстановление работы проектов**
    - maximus: redis не может быть запланирован
    - gyber.org и 1otc.cc: требуют проверки после очистки

## 🎯 ЗАДАЧИ ДЛЯ РЕШЕНИЯ

### Приоритет 1: КРИТИЧНО (блокирует все)

1. **Очистить массу Pending подов** ⏳ В ПРОЦЕССЕ
   - ✅ Удалено ~100+ challenge подов
   - ⏳ Продолжать удаление меньшими батчами (API server перегружен)
   - ⏳ Очистить namespace platform-gyber-org от мусора
   - ⏳ Очистить Challenge, CertificateRequest, Order ресурсы
   - **ПРОБЛЕМА:** API server таймаутит из-за перегрузки (99% CPU)
   - **РЕШЕНИЕ:** Удалять по namespace, меньшими батчами, с паузами

2. **Снизить нагрузку на control-plane узел** ⏳ ЗАВИСИТ ОТ ПУНКТА 1
   - ✅ Определено: scheduler перегружен из-за тысяч Pending подов
   - ⏳ После очистки Pending подов нагрузка должна снизиться автоматически
   - ⏳ Если не поможет - оптимизировать или перенести нагрузку

3. **Настроить и перезапустить cert-manager** ⏳ ОЖИДАЕТ ОЧИСТКИ
   - ✅ Cert-manager остановлен
   - ⏳ Применить правильную конфигурацию:
     - `--max-concurrent-challenges=5`
     - `--acme-http01-solver-pod-grace-period=1m`
     - `--enable-certificate-owner-ref=true`
   - ⏳ Перезапустить после очистки Pending подов

4. **Принудительно удалить зависшие поды** ❌ НЕ НАЧАТО
   - Очистить finalizers у подов на отключенном узле
   - Удалить поды, которые зависли в Terminating

### Приоритет 2: ВАЖНО

5. **Унифицировать конфигурации проектов** ⏳ ЧАСТИЧНО
   - ✅ Исправлены ingress: supabase (nginx→traefik), aura-domus (istio→traefik)
   - ⏳ Исправить остальные ingress конфигурации в проектах:
     - `TECHHY_PROJECTS/open-router-telegram-wrapper`: nginx → traefik
     - `TRADER-AGENT`: несколько ingress с nginx
     - `multi-swarm-system`: унифицировать ingress controllers
   - ⏳ Унифицировать ClusterIssuer (все на `letsencrypt-prod` для prod, `letsencrypt-staging` для stage)
   - ⏳ Создать явные Certificate ресурсы вместо автоматических

6. **Восстановить работу проектов** ❌ ОЖИДАЕТ ОЧИСТКИ
   - Запустить поды maximus и redis на рабочих узлах
   - Проверить доступность всех трех сайтов
   - Убедиться, что endpoints работают

7. **Проверить и исправить Ingress и сертификаты** ⏳ ЧАСТИЧНО
   - ✅ Исправлены проблемные ingress конфигурации
   - ⏳ Применить исправленные конфигурации в кластер
   - ⏳ Проверить, что сертификаты выпущены и действительны
   - ⏳ Проверить редиректы HTTP → HTTPS

### Приоритет 3: ОПТИМИЗАЦИЯ

7. **Мониторинг и профилактика**
   - Настроить автоматическую очистку старых Pending подов
   - Оптимизировать конфигурацию cert-manager
   - Добавить мониторинг нагрузки на узлы

## 🔍 МЕТОДОЛОГИЯ АНАЛИЗА

### Шаг 1: Глобальная диагностика
```bash
# Проверить общее состояние кластера
kubectl get nodes -o wide
kubectl top nodes
kubectl get pods --all-namespaces | grep -E "Pending|CrashLoopBackOff|Error" | wc -l

# Проверить проблемные namespace
kubectl get namespaces
kubectl get pods -n platform-gyber-org --field-selector status.phase=Pending | wc -l

# Проверить нагрузку на control-plane
kubectl top node tmedm
kubectl get pods -n kube-system -o wide | grep tmedm
```

### Шаг 2: Анализ корневых причин
- Что потребляет CPU на control-plane узле?
- Почему создается так много Pending подов?
- Почему cert-manager не может завершить challenges?
- Почему поды зависают в Terminating?

### Шаг 3: Системное решение
- Не просто удалять симптомы, а исправлять причины
- Оптимизировать конфигурации, которые вызывают проблемы
- Предотвратить повторение проблем в будущем

## 📋 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

### Проверка нагрузки на control-plane
```bash
kubectl top node tmedm
kubectl get pods -n kube-system -o wide --field-selector spec.nodeName=tmedm
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=tmedm | wc -l
```

### Анализ Pending подов
```bash
# Общее количество
kubectl get pods --all-namespaces --field-selector status.phase=Pending | wc -l

# По namespace
kubectl get pods --all-namespaces --field-selector status.phase=Pending -o json | \
  jq -r '.items[] | .metadata.namespace' | sort | uniq -c | sort -rn

# Старые Pending поды (старше 1 часа)
kubectl get pods --all-namespaces --field-selector status.phase=Pending -o json | \
  jq -r '.items[] | select((.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | "\(.metadata.namespace)/\(.metadata.name)"'
```

### Анализ cert-manager проблем
```bash
kubectl get pods -n cert-manager
kubectl get challenges -A | grep -i error
kubectl logs -n cert-manager -l app=cert-manager --tail=100
```

### Очистка зависших подов
```bash
# На отключенном узле
kubectl get pods --all-namespaces -o json | \
  jq -r '.items[] | select(.spec.nodeName=="canton-node-65-108-15-30" and .status.phase=="Terminating") | "\(.metadata.namespace)/\(.metadata.name)"' | \
  while read pod; do
    ns=$(echo $pod | cut -d/ -f1)
    name=$(echo $pod | cut -d/ -f2)
    kubectl patch pod $name -n $ns -p '{"metadata":{"finalizers":[]}}' --type=merge
  done
```

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После исправления:
- ✅ Control-plane узел не перегружен (<80% CPU)
- ✅ Количество Pending подов минимально (<100, только временные)
- ✅ Cert-manager работает корректно
- ✅ Все три сайта доступны (gyber.org, 1otc.cc, maximus-marketing-swarm.gyber.org)
- ✅ Поды maximus и redis запущены и работают
- ✅ Нет зависших подов в Terminating
- ✅ Scheduler работает эффективно

## 📝 ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Глобальный подход:** Не исправлять отдельные симптомы, а найти и устранить корневые причины
2. **Системный анализ:** Понимать взаимосвязи между проблемами (перегрузка → scheduler → Pending поды)
3. **Безопасность:** Не удалять критически важные ресурсы, только мусор и старые объекты
4. **Документирование:** Сохранять отчеты о диагностике и исправлениях

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

### Документация:
- `CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md` - полный план восстановления и организации кластера
- `CLUSTER_ANALYSIS_REPORT.md` - детальный отчет по анализу и найденным противоречиям
- `KUBERNETES_CLUSTER_FIX_PROMPT.md` - исходное описание проблем
- `KUBERNETES_FIX_EXECUTION_GUIDE.md` - руководство по исправлению

### Скрипты восстановления:
- `scripts/cluster-recovery-critical.sh` - скрипт критического восстановления (остановка cert-manager, удаление проблемных ingress/Certificate)
- `scripts/cleanup-simple.sh` - упрощенный скрипт очистки Pending подов
- `scripts/cleanup-direct.sh` - прямой скрипт очистки через API с короткими таймаутами
- `scripts/fix-ingress-configurations.sh` - скрипт для исправления ingress конфигураций в проектах
- `scripts/fix-maximus-scheduling-complete.sh` - скрипт исправления планирования
- `scripts/verify-all-sites.sh` - скрипт проверки сайтов

### Исправленные конфигурации:
- `canton-otc/k8s/supabase/ingress.yaml` - исправлен (nginx → traefik)
- `aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml` - исправлен (istio → traefik)

## 🚀 ТЕКУЩИЙ СТАТУС И СЛЕДУЮЩИЕ ШАГИ

### ✅ ВЫПОЛНЕНО:
1. ✅ Анализ всех проектов экосистемы - найдены противоречия
2. ✅ Остановлен cert-manager
3. ✅ Удалены проблемные ingress (istio, nginx)
4. ✅ Удалены проблемные Certificate ресурсы
5. ✅ Начата очистка Pending подов (~100+ удалено)
6. ✅ Исправлены ingress конфигурации (supabase, aura-domus)

### ⏳ В ПРОЦЕССЕ:
1. **Очистка Pending подов** - API server перегружен, удаление идет медленно
   - Продолжать удаление меньшими батчами по namespace
   - Использовать скрипты с короткими таймаутами
   - После очистки нагрузка на control-plane должна снизиться

### 📋 СЛЕДУЮЩИЕ ШАГИ:
1. **Завершить очистку Pending подов**
   - Продолжать удаление через `scripts/cleanup-direct.sh` или вручную
   - Очистить Challenge, CertificateRequest, Order ресурсы
   - Проверить снижение нагрузки на control-plane

2. **Настроить cert-manager правильно**
   - Применить конфигурацию с ограничениями
   - Перезапустить cert-manager

3. **Применить исправленные ingress конфигурации**
   - Применить исправленные ingress для supabase и aura-domus
   - Исправить остальные проблемные ingress в проектах

4. **Унифицировать ClusterIssuer**
   - Обновить все ingress на `letsencrypt-prod` или `letsencrypt-staging`
   - Создать явные Certificate ресурсы

5. **Восстановить работу проектов**
   - Проверить планирование подов после очистки
   - Запустить maximus и redis
   - Проверить доступность сайтов

---

**ВАЖНО:** Анализировать проблемы системно, находить корневые причины, а не просто удалять симптомы. Цель - восстановить стабильное и эффективное состояние кластера.

---

## 📊 НАЙДЕННЫЕ ПРОТИВОРЕЧИЯ В ПРОЕКТАХ ЭКОСИСТЕМЫ

### 1. КОНФЛИКТ INGRESS CONTROLLERS
**Проблема:** Проекты используют несуществующие ingress controllers
- **Istio:** 11 ingress используют Istio, но в кластере установлен только Traefik
- **Nginx:** 1 ingress использует Nginx, но в кластере установлен только Traefik

**Найденные проблемные проекты:**
- `canton-otc/k8s/supabase/ingress.yaml` - nginx (✅ исправлено)
- `aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml` - istio (✅ исправлено)
- `TECHHY_PROJECTS/open-router-telegram-wrapper` - nginx
- `TRADER-AGENT` - несколько ingress с nginx
- `multi-swarm-system` - разные ingress controllers для prod/stage

### 2. РАЗНООБРАЗИЕ CLUSTERISSUER
**Проблема:** Проекты используют разные ClusterIssuer без единой стратегии
- `letsencrypt-prod` - используется большинством проектов
- `letsencrypt-production` - используется некоторыми проектами (может вызывать путаницу)
- `letsencrypt-staging` - используется для stage окружений

**Рекомендация:** Унифицировать на `letsencrypt-prod` для production и `letsencrypt-staging` для stage.

### 3. АВТОМАТИЧЕСКОЕ СОЗДАНИЕ CERTIFICATE
**Проблема:** Все ingress с аннотацией `cert-manager.io/cluster-issuer` автоматически создают Certificate
- Certificate создаются даже для неработающих ingress
- Нет явного управления Certificate ресурсами
- Сложно отслеживать и управлять сертификатами

**Рекомендация:** Использовать явное создание Certificate ресурсов вместо автоматического через аннотации.
