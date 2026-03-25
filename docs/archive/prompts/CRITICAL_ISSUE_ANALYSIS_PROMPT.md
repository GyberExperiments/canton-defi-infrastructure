# 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: САЙТ 1OTC.CC НЕ РАБОТАЕТ - ПОЛНЫЙ АНАЛИЗ И ВОССТАНОВЛЕНИЕ

## 📋 КОНТЕКСТ ПРОБЛЕМЫ

**Дата:** 16 декабря 2025  
**Проект:** Canton OTC Exchange  
**URL:** https://1otc.cc  
**Проблема:** Сайт возвращает 504 Gateway Timeout и 502 Bad Gateway ошибки

### Симптомы проблемы:

1. **504 Gateway Timeout** для всех статических файлов Next.js:
   - `/_next/static/css/*.css`
   - `/_next/static/chunks/*.js`
   - `/_next/static/media/*.woff2`

2. **502 Bad Gateway** для некоторых ресурсов:
   - `/icon.svg`

3. **MIME type ошибки:**
   - CSS файлы отдаются как `text/plain` вместо `text/css`
   - JS файлы отдаются как `text/plain` вместо `application/javascript`



### История проблемы:

- **Причина:** Сервер кластера был выключен по непонятной причине 
- **Действие:** Сервер включен обратно
- **Текущее состояние:** Сайт частично доступен (HTTPS работает), но поды приложения не отвечают

---

## 🎯 ЗАДАЧА ДЛЯ AI АССИСТЕНТА

**ЦЕЛЬ:** Провести полный анализ проблемы, собрать все необходимые данные и логи, найти корневую причину, качественно устранить проблему и предотвратить повторение в будущем.

### Требования:

1. ✅ **Полный анализ** - не поверхностный, а глубокий анализ всех компонентов
2. ✅ **Сбор всех данных** - логи, события, статусы, конфигурации
3. ✅ **Найти корневую причину** - не симптом, а именно причину
4. ✅ **Качественное решение** - не временные костыли, а правильное исправление
5. ✅ **Предотвращение повторения** - добавить мониторинг/алерты/автоматическое восстановление

---

## 📊 ПЛАН АНАЛИЗА (выполнить пошагово)

### ШАГ 1: Диагностика кластера и инфраструктуры

```bash
# 1.1. Проверка доступности кластера
kubectl cluster-info
kubectl get nodes -o wide

# 1.2. Проверка всех namespace и проектов
kubectl get namespaces
kubectl get deployments --all-namespaces | grep -E "canton|NAME"

# 1.3. Проверка ресурсов кластера
kubectl top nodes
kubectl top pods --all-namespaces --sort-by=memory | head -20
```

**Что проверить:**
- ✅ Все ли ноды в состоянии Ready
- ✅ Достаточно ли ресурсов (CPU/Memory)
- ✅ Есть ли другие проблемные проекты, которые могут влиять

---

### ШАГ 2: Детальный анализ проекта canton-otc

```bash
NAMESPACE="canton-otc"
DEPLOYMENT="canton-otc"

# 2.1. Статус всех ресурсов в namespace
kubectl get all -n $NAMESPACE

# 2.2. Детальный статус подов
kubectl get pods -n $NAMESPACE -o wide
kubectl describe pods -n $NAMESPACE -l app=$DEPLOYMENT

# 2.3. События (последние 50)
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -50

# 2.4. Логи всех подов (последние 100 строк каждого)
for pod in $(kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT -o jsonpath='{.items[*].metadata.name}'); do
  echo "=== Логи пода $pod ==="
  kubectl logs $pod -n $NAMESPACE --tail=100
  echo ""
done

# 2.5. Логи предыдущих контейнеров (если были рестарты)
kubectl logs -n $NAMESPACE -l app=$DEPLOYMENT --previous --tail=100
```

**Что проверить:**
- ✅ В каком состоянии поды (Running/Pending/CrashLoopBackOff/Error)
- ✅ Есть ли ошибки в логах
- ✅ Были ли рестарты подов
- ✅ Какие события произошли (Failed, BackOff, etc.)

---

### ШАГ 3: Проверка конфигурации

```bash
# 3.1. Deployment конфигурация
kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o yaml > /tmp/deployment-current.yaml

# 3.2. ConfigMap
kubectl get configmap canton-otc-config -n $NAMESPACE -o yaml
kubectl get configmap canton-otc-config -n $NAMESPACE -o jsonpath='{.data}' | jq .

# 3.3. Secrets (проверить наличие, не содержимое)
kubectl get secret canton-otc-secrets -n $NAMESPACE
kubectl get secret ghcr-secret -n $NAMESPACE

# 3.4. Service
kubectl get service canton-otc-service -n $NAMESPACE -o yaml
kubectl describe service canton-otc-service -n $NAMESPACE

# 3.5. Ingress
kubectl get ingress -n $NAMESPACE -o yaml
kubectl describe ingress -n $NAMESPACE
```

**Что проверить:**
- ✅ Правильно ли настроен deployment (replicas, image, resources)
- ✅ Есть ли все необходимые ConfigMap и Secrets
- ✅ Правильно ли настроен Service (порты, selector)
- ✅ Правильно ли настроен Ingress (hosts, paths, TLS)

---

### ШАГ 4: Проверка health checks и readiness

```bash
# 4.1. Проверка health endpoint внутри пода
POD=$(kubectl get pods -n $NAMESPACE -l app=$DEPLOYMENT -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -n $NAMESPACE -- curl -s http://localhost:3000/api/health || echo "Health check failed"

# 4.2. Проверка readiness probe
kubectl get pod $POD -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")]}' | jq .

# 4.3. Проверка liveness probe
kubectl get pod $POD -n $NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="ContainersReady")]}' | jq .
```

**Что проверить:**
- ✅ Отвечает ли приложение на health checks
- ✅ Проходят ли readiness/liveness probes
- ✅ Правильно ли настроены probe endpoints

---

### ШАГ 5: Проверка сетевой связности

```bash
# 5.1. Endpoints Service
kubectl get endpoints canton-otc-service -n $NAMESPACE

# 5.2. Проверка связи Service -> Pods
kubectl exec $POD -n $NAMESPACE -- wget -qO- http://canton-otc-service/api/health || echo "Service connection failed"

# 5.3. Проверка Ingress -> Service
kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[*].spec.rules[*].http.paths[*].backend.service.name}'
```

**Что проверить:**
- ✅ Есть ли endpoints у Service (подключены ли поды)
- ✅ Работает ли маршрутизация Service -> Pods
- ✅ Правильно ли настроен Ingress backend

---

### ШАГ 6: Проверка образа и registry

```bash
# 6.1. Какой образ используется
kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}'

# 6.2. Проверка imagePullSecrets
kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.imagePullSecrets[*].name}'

# 6.3. События ImagePull
kubectl get events -n $NAMESPACE --field-selector reason=Failed | grep -i image
```

**Что проверить:**
- ✅ Существует ли образ в registry
- ✅ Правильно ли настроены imagePullSecrets
- ✅ Не было ли ошибок при загрузке образа

---

### ШАГ 7: Сравнение с ожидаемой конфигурацией

```bash
# 7.1. Сравнить текущий deployment с манифестом
diff <(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o yaml) \
     config/kubernetes/k8s/deployment.yaml

# 7.2. Проверить соответствие ConfigMap
kubectl get configmap canton-otc-config -n $NAMESPACE -o yaml > /tmp/configmap-current.yaml
# Сравнить с config/kubernetes/k8s/configmap.yaml
```

**Что проверить:**
- ✅ Соответствует ли текущая конфигурация манифестам в репозитории
- ✅ Не было ли ручных изменений, которые могли сломать систему

---

## 🔍 АНАЛИЗ ПРОБЛЕМЫ

### Возможные причины (проверить каждую):

1. **Поды не запускаются:**
   - ❓ CreateContainerConfigError (нет ConfigMap/Secret)
   - ❓ ImagePullBackOff (не может загрузить образ)
   - ❓ CrashLoopBackOff (приложение падает при старте)
   - ❓ Pending (недостаточно ресурсов)

2. **Поды запускаются, но не отвечают:**
   - ❓ Health checks не проходят
   - ❓ Приложение зависает/падает после старта
   - ❓ Неправильные порты в конфигурации
   - ❓ Проблемы с зависимостями (Redis, DB, etc.)

3. **Проблемы с сетью:**
   - ❓ Service не имеет endpoints
   - ❓ Ingress неправильно настроен
   - ❓ Проблемы с Traefik/Ingress Controller

4. **Проблемы с ресурсами:**
   - ❓ Недостаточно CPU/Memory
   - ❓ Превышены лимиты
   - ❓ Ноды перегружены

5. **Проблемы после перезапуска сервера:**
   - ❓ PersistentVolumes не примонтированы
   - ❓ Secrets/ConfigMap не загружены
   - ❓ Зависимости (Redis, DB) не запущены

---

## 🛠️ ПЛАН ВОССТАНОВЛЕНИЯ

### После анализа выполнить:

1. **Исправить найденные проблемы:**
   - Восстановить недостающие ресурсы (ConfigMap, Secrets)
   - Исправить конфигурацию (если есть расхождения)
   - Перезапустить deployment если нужно

2. **Проверить работоспособность:**
   ```bash
   # Проверка подов
   kubectl get pods -n canton-otc -w
   
   # Проверка сайта
   curl -I https://1otc.cc
   curl https://1otc.cc/api/health
   
   # Проверка статических файлов
   curl -I https://1otc.cc/_next/static/css/app.css
   ```

3. **Добавить мониторинг/предотвращение:**
   - Настроить alerts для критических состояний
   - Добавить автоматическое восстановление (если возможно)
   - Документировать процедуру восстановления

---

## 📝 ФАЙЛЫ ДЛЯ АНАЛИЗА

### Критичные файлы проекта:

1. **Kubernetes манифесты:**
   - `config/kubernetes/k8s/deployment.yaml` - основной deployment
   - `config/kubernetes/k8s/service.yaml` - service конфигурация
   - `config/kubernetes/k8s/ingress.yaml` - ingress конфигурация
   - `config/kubernetes/k8s/configmap.yaml` - конфигурация приложения

2. **Документация:**
   - `docs/deployment/DEPLOY_INSTRUCTIONS.md` - инструкции по деплою
   - `CLUSTER_RECOVERY_PLAN.md` - план восстановления
   - `docs/analysis/FULL_CLUSTER_ANALYSIS.md` - предыдущий анализ кластера

3. **Скрипты:**
   - `scripts/diagnose-cluster.sh` - скрипт диагностики

---

## ✅ КРИТЕРИИ УСПЕШНОГО ВОССТАНОВЛЕНИЯ

После исправления должно быть:

1. ✅ Все поды в состоянии `Running` и `Ready`
2. ✅ Сайт https://1otc.cc открывается без ошибок
3. ✅ Статические файлы загружаются (CSS, JS, fonts)
4. ✅ API endpoints отвечают (например, `/api/health`)
5. ✅ Нет ошибок в консоли браузера
6. ✅ Нет ошибок в логах подов

---

## 🎯 ИНСТРУКЦИИ ДЛЯ AI АССИСТЕНТА

1. **НЕ ПРОПУСКАТЬ ШАГИ** - выполнить все шаги анализа по порядку
2. **СОБРАТЬ ВСЕ ДАННЫЕ** - логи, события, конфигурации, статусы
3. **НАЙТИ КОРНЕВУЮ ПРИЧИНУ** - не останавливаться на симптомах
4. **ПРЕДЛОЖИТЬ КАЧЕСТВЕННОЕ РЕШЕНИЕ** - не временные костыли
5. **ДОКУМЕНТИРОВАТЬ** - записать что было найдено и как исправлено
6. **ПРЕДОТВРАТИТЬ ПОВТОРЕНИЕ** - предложить улучшения (мониторинг, алерты, автоматизация)

---

## 📋 CHECKLIST ВЫПОЛНЕНИЯ

- [ ] Шаг 1: Диагностика кластера выполнена
- [ ] Шаг 2: Анализ проекта canton-otc выполнен
- [ ] Шаг 3: Проверка конфигурации выполнена
- [ ] Шаг 4: Проверка health checks выполнена
- [ ] Шаг 5: Проверка сетевой связности выполнена
- [ ] Шаг 6: Проверка образа выполнена
- [ ] Шаг 7: Сравнение с ожидаемой конфигурацией выполнено
- [ ] Корневая причина найдена и задокументирована
- [ ] Проблема исправлена
- [ ] Работоспособность проверена
- [ ] Предложения по предотвращению подготовлены

---

**ВАЖНО:** Не торопиться, провести тщательный анализ. Лучше потратить больше времени на анализ, чем потом исправлять неправильное решение.

---

**Автор:** AI Assistant  
**Дата:** 16 декабря 2025  
**Приоритет:** КРИТИЧЕСКИЙ


Здравствуйте!

На данный момент на вашем VPS были временно заблокированы внешние подключения к портам 45.9.41.209, 31.129.105.180, задействованным приложениями на базе React Server Components. Это связано с выявленной критической уязвимостью CVE-2025-55182, которая позволяет выполнить код ещё до аутентификации. С более подробной информацией вы можете ознакомиться в статье:

https://t.me/beget_official/468
Блокировка введена для обеспечения безопасности ваших серверов и данных. Мы постарались произвести блокировку аккуратно и не затронуть порты, на которых могли бы работать другие приложения (исключили порты 80 и 443).

Что нужно сделать:
Обновите ваше приложение и связанные пакеты React Server Components до исправленных версий. Уязвимые пакеты включают:

react-server-dom-webpack
react-server-dom-parcel
react-server-dom-turbopack
и другие пакеты RSC версий 19.0.0–19.2.0.
Также, некоторые React-фреймворки и бандлеры зависели от уязвимых React-пакетов, имели взаимные зависимости от них или включали их. Затронуты следующие React-фреймворки и бандлеры:

next
react-router
waku
rwsdk
@parcel/rsc
@vitejs/plugin-rsc
Список исправленных версий каждого компонента в своём release line можно найти найти в указанной ранее статье, а также на странице:

https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components
После обновления напишите в поддержку, указав IP вашего VPS, мы снимем ограничения.
Дополнительно обратиться к профильным специалистам ИБ для проведения аудита безопасности сервера.
Благодарим за понимание - меры приняты исключительно ради вашей безопасности.

вот что ответила поддержка - я попросил снять ограничение что m,s мы всё нашли что надо пофиксить и пофиксили 