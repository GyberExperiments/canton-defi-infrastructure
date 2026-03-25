# 🔐 Комплексный Промт для Аудита Безопасности Canton OTC

## 📋 Введение

Данный промт предназначен для проведения всестороннего аудита безопасности проекта Canton OTC и Kubernetes кластера в соответствии с международными стандартами безопасности 2025 года.

## 🎯 Цели аудита

1. Оценка соответствия требованиям ISO/IEC 27001:2022, NIST SP 800-190, CIS Kubernetes Benchmark 1.8
2. Выявление критических уязвимостей в инфраструктуре и приложении
3. Анализ архитектуры безопасности и управления доступом
4. Проверка механизмов защиты конфиденциальных данных
5. Оценка готовности к инцидентам безопасности

## 🏗️ Структура проекта

### Основные компоненты:
- **Приложение**: Next.js 15.1.0 с TypeScript
- **Инфраструктура**: Kubernetes (K3s)
- **База данных**: Redis 7
- **Контейнеризация**: Docker с multi-stage build
- **CI/CD**: GitHub Actions с ArgoCD
- **Сети**: Traefik Ingress Controller

### Ключевые зависимости:
- Криптографические библиотеки: ethers, bip39, bip32, eccrypto, tweetnacl
- Аутентификация: next-auth, bcryptjs
- Внешние сервисы: Google Sheets API, Telegram Bot API, Intercom API
- Kubernetes интеграция: @kubernetes/client-node

## 📊 Области аудита

### 1. Инфраструктура Kubernetes

#### 1.1 Конфигурация кластера
```bash
# Проверка версии и компонентов
kubectl version
kubectl get nodes -o wide
kubectl get namespaces

# Анализ RBAC
kubectl get clusterroles,clusterrolebindings
kubectl get roles,rolebindings -A

# Проверка сетевых политик
kubectl get networkpolicies -A

# Pod Security Admission
kubectl get namespaces -o json | jq '.items[] | {name: .metadata.name, labels: .metadata.labels}'

# Анализ секретов
kubectl get secrets -A
kubectl get secrets -A -o json | jq '.items[] | select(.type != "kubernetes.io/service-account-token") | {namespace: .metadata.namespace, name: .metadata.name, type: .type}'
```

#### 1.2 Безопасность подов
```bash
# Проверка контекстов безопасности
kubectl get pods -A -o json | jq '.items[] | {
  namespace: .metadata.namespace,
  name: .metadata.name,
  securityContext: .spec.securityContext,
  containers: [.spec.containers[] | {
    name: .name,
    securityContext: .securityContext,
    image: .image,
    runAsNonRoot: .securityContext.runAsNonRoot,
    readOnlyRootFilesystem: .securityContext.readOnlyRootFilesystem,
    allowPrivilegeEscalation: .securityContext.allowPrivilegeEscalation,
    capabilities: .securityContext.capabilities
  }]
}'

# Проверка service accounts
kubectl get serviceaccounts -A
kubectl get serviceaccounts -A -o json | jq '.items[] | {namespace: .metadata.namespace, name: .metadata.name, automountServiceAccountToken: .automountServiceAccountToken}'
```

#### 1.3 Сетевая безопасность
```bash
# Анализ сервисов и endpoints
kubectl get services,endpoints -A

# Проверка Ingress правил
kubectl get ingressroute -A -o yaml
kubectl get ingress -A -o yaml

# TLS сертификаты
kubectl get certificates -A
kubectl get secrets -A | grep tls
```

### 2. Безопасность приложения

#### 2.1 Анализ кода
- Проверка обработки пользовательского ввода
- Анализ криптографических операций
- Проверка хранения и передачи секретов
- Валидация API endpoints
- Проверка аутентификации и авторизации

#### 2.2 Зависимости
```bash
# Проверка уязвимостей в npm пакетах
npm audit
pnpm audit

# Анализ Docker образа
docker scout cves ghcr.io/themacroeconomicdao/cantonotc:minimal-stage
```

#### 2.3 Конфигурация
- Анализ переменных окружения
- Проверка ConfigMaps и Secrets
- Валидация CORS политик
- Проверка CSP заголовков

### 3. Управление секретами

#### 3.1 Хранение секретов
```bash
# Проверка шифрования etcd
kubectl get secrets -A -o json | jq '.items[] | {name: .metadata.name, created: .metadata.creationTimestamp}'

# External Secrets Operator
kubectl get externalsecrets -A
kubectl get secretstores -A
```

#### 3.2 Ротация секретов
- Проверка политик ротации
- Анализ сроков действия сертификатов
- Проверка процедур обновления ключей

### 4. Мониторинг и логирование

#### 4.1 Аудит логи
```bash
# Проверка audit policy
kubectl get auditpolicy -A

# События безопасности
kubectl get events -A | grep -i "security\|denied\|failed\|error"

# Логи подов
kubectl logs -n canton-otc-minimal-stage deployment/canton-otc --tail=1000 | grep -i "error\|warning\|unauthorized\|forbidden"
```

#### 4.2 Метрики безопасности
- Анализ метрик доступа
- Проверка аномалий в трафике
- Мониторинг ресурсов

### 5. Соответствие стандартам

#### 5.1 OWASP Top 10 для Kubernetes
1. **Небезопасные конфигурации рабочих нагрузок**
2. **Проблемы управления цепочкой поставок**
3. **Чрезмерно широкие разрешения**
4. **Отсутствие централизованного управления политиками**
5. **Недостаточное логирование и мониторинг**
6. **Сломанная аутентификация**
7. **Отсутствующие сетевые политики сегментации**
8. **Секреты и ключи в образах контейнеров**
9. **Неправильно настроенные образы**
10. **Устаревшие и уязвимые компоненты**

#### 5.2 CIS Kubernetes Benchmark
- Control Plane конфигурация
- Worker Node безопасность
- Политики RBAC
- Pod Security Standards
- Сетевые политики и сегментация

#### 5.3 NIST Cybersecurity Framework
- **Identify**: Инвентаризация активов
- **Protect**: Контроль доступа и шифрование
- **Detect**: Мониторинг и обнаружение аномалий
- **Respond**: План реагирования на инциденты
- **Recover**: Процедуры восстановления

## 🔍 Методология проведения аудита

### Фаза 1: Разведка и сбор информации
```bash
# Сбор базовой информации о кластере
kubectl cluster-info
kubectl get all -A
kubectl api-resources

# Анализ конфигураций
kubectl get configmaps -A
kubectl describe deployments -A
```

### Фаза 2: Анализ уязвимостей
```bash
# Сканирование образов
trivy image ghcr.io/themacroeconomicdao/cantonotc:minimal-stage

# Проверка CIS compliance
kube-bench run --targets master,node,etcd,policies

# Анализ RBAC
kubectl-who-can create pods -A
rakkess
```

### Фаза 3: Тестирование безопасности
```bash
# Проверка доступов
kubectl auth can-i --list
kubectl auth can-i create pods --all-namespaces

# Тест сетевых политик
kubectl run test-pod --image=busybox --rm -it -- /bin/sh
# Внутри пода: проверка доступности сервисов

# Проверка escape-последовательностей
kubectl exec -it <pod> -- /bin/sh
# Попытка повышения привилегий
```

### Фаза 4: Документирование результатов

## 📝 Чек-лист аудита

### Инфраструктура
- [ ] Kubernetes API Server защищен и доступен только авторизованным пользователям
- [ ] RBAC настроен по принципу наименьших привилегий
- [ ] Сетевые политики ограничивают взаимодействие между подами
- [ ] Pod Security Standards применены ко всем namespace
- [ ] Secrets зашифрованы в etcd
- [ ] Audit logging включен и настроен
- [ ] Admission controllers настроены корректно

### Приложение
- [ ] Входные данные валидируются на всех уровнях
- [ ] Криптографические операции используют безопасные алгоритмы
- [ ] Секреты не хранятся в коде или образах
- [ ] Сессии защищены и имеют timeout
- [ ] API endpoints требуют аутентификацию
- [ ] CORS настроен корректно
- [ ] CSP заголовки настроены

### Контейнеры
- [ ] Образы не содержат уязвимостей
- [ ] Контейнеры запускаются от non-root пользователя
- [ ] Root filesystem read-only
- [ ] Capabilities минимизированы
- [ ] Security contexts настроены

### Мониторинг
- [ ] Логирование покрывает все критические операции
- [ ] Алерты настроены на подозрительную активность
- [ ] Метрики безопасности собираются
- [ ] Инциденты безопасности документируются

## 🚨 Критические проверки

1. **HD Wallet Seed в Dockerfile**
   ```dockerfile
   ENV HD_WALLET_SEED="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
   ```
   ⚠️ Использование тестового seed в production окружении

2. **Отсутствие Pod Security Context**
   ```json
   "securityContext": null
   ```
   ⚠️ Контейнеры запускаются без ограничений безопасности

3. **Отсутствие Network Policies**
   ⚠️ Только 3 namespace имеют сетевые политики из 23

4. **Service Account без ограничений**
   ⚠️ Автоматическое монтирование токенов не отключено

## 📊 Метрики безопасности

### KPI для мониторинга:
1. Количество критических уязвимостей в образах: 0
2. Процент подов с security context: 100%
3. Покрытие namespace сетевыми политиками: 100%
4. Время обнаружения инцидента: < 5 минут
5. Время реагирования на инцидент: < 30 минут

## 🔧 Инструменты для автоматизации

### Сканеры безопасности:
- **Trivy**: Сканирование образов и конфигураций
- **Kubesec**: Анализ манифестов Kubernetes
- **kube-bench**: Проверка CIS Kubernetes Benchmark
- **Falco**: Runtime security monitoring
- **OPA/Gatekeeper**: Policy enforcement

### Мониторинг:
- **Prometheus + Grafana**: Метрики
- **Loki**: Централизованное логирование
- **Jaeger**: Distributed tracing
- **Sysdig/Datadog**: Комплексный мониторинг

## 📋 План действий после аудита

1. **Немедленные действия** (Critical):
   - Изменить HD Wallet Seed на production значение
   - Добавить Pod Security Context ко всем подам
   - Настроить Network Policies для всех namespace

2. **Краткосрочные** (High):
   - Внедрить Pod Security Standards
   - Настроить RBAC по принципу least privilege
   - Включить audit logging

3. **Среднесрочные** (Medium):
   - Внедрить автоматическое сканирование образов
   - Настроить централизованное логирование
   - Реализовать secrets rotation

4. **Долгосрочные** (Low):
   - Внедрить Zero Trust архитектуру
   - Автоматизировать compliance проверки
   - Провести обучение команды

## 🎯 Заключение

Данный промт обеспечивает комплексный подход к аудиту безопасности, охватывая все критические аспекты современной cloud-native инфраструктуры. Регулярное проведение таких аудитов поможет поддерживать высокий уровень безопасности и соответствие международным стандартам.

---

**Дата создания**: ${new Date().toISOString()}
**Версия**: 1.0
**Автор**: Security Audit AI Assistant
