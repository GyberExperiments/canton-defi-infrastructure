# 🔬 ИССЛЕДОВАТЕЛЬСКИЙ ПРОМПТ: Запуск Canton Validator (Docker Compose) в Kubernetes

## 📋 КОНТЕКСТ ПРОБЛЕМЫ

**Текущая ситуация:**
- У нас есть Docker образ `ghcr.io/themacroeconomicdao/canton-node:0.5.8`
- Этот образ является **wrapper'ом для Docker Compose**, а НЕ самостоятельным приложением
- Внутри образа скрипт `/opt/canton/start.sh` (строка 267) выполняет:
  ```bash
  docker compose -f "${script_dir}/compose.yaml" "${extra_compose_files[@]}" up -d "${extra_args[@]}"
  ```
- В Kubernetes Pod'е команда `docker` недоступна → **CrashLoopBackOff**

**Архитектура Docker Compose стека (из `/opt/canton/compose.yaml`):**

1. **PostgreSQL** (`postgres:14`)
   - Базы данных: participant-0, validator
   - Порт: 5432

2. **Canton Participant** (`ghcr.io/themacroeconomicdao/canton-participant:0.5.8`)
   - Ledger API: 4001
   - Admin API: 4002
   - Зависит от PostgreSQL

3. **Validator App** (`ghcr.io/themacroeconomicdao/validator-app:0.5.8`)
   - Validator API: 5003
   - Validator Admin: 5004
   - Зависит от PostgreSQL и Participant

4. **Wallet Web UI** (`ghcr.io/themacroeconomicdao/wallet-web-ui:0.5.8`)
   - Web интерфейс

5. **ANS Web UI** (`ghcr.io/themacroeconomicdao/ans-web-ui:0.5.8`)
   - Web интерфейс

6. **Nginx** (reverse proxy)
   - Порт: 80

**Kubernetes окружение:**
- K3s cluster
- Node IP: 65.108.15.30
- Namespace: canton-node
- hostNetwork: true (требуется для валидатора)

**Критическая проблема:**
Отдельные образы `canton-participant:0.5.8` и `validator-app:0.5.8` **НЕ доступны** в GHCR!
Они используются только внутри `canton-node` образа через Docker Compose.

---

## 🎯 ЗАДАЧА ИССЛЕДОВАНИЯ

Найти **ЛУЧШЕЕ PRODUCTION-READY решение** для запуска Canton Validator в Kubernetes, где единственный доступный образ - это `canton-node:0.5.8` с встроенным Docker Compose.

---

## 🔍 ВАРИАНТЫ ДЛЯ ГЛУБОКОГО ИССЛЕДОВАНИЯ

### Вариант 1: Docker-in-Docker (DinD) в Kubernetes
**Исследовать:**
- Как настроить DinD сайдкар-контейнер в Kubernetes Pod
- Security implications (privileged containers, securityContext)
- Примеры production deployments с DinD
- Performance overhead и best practices
- Альтернативы: Podman, Kaniko

**Ключевые вопросы:**
- Как пробросить Docker socket в контейнер безопасно?
- Нужен ли privileged режим?
- Как обеспечить persistence для Docker volumes?

### Вариант 2: Конвертация через Kompose
**Исследовать:**
- Может ли Kompose конвертировать `/opt/canton/compose.yaml` в K8s манифесты?
- Как извлечь compose.yaml из образа и адаптировать для Kompose
- Limitations Kompose с complex compose files

**Команды для проверки:**
```bash
# Извлечь compose.yaml из образа
docker run --rm ghcr.io/themacroeconomicdao/canton-node:0.5.8 cat /opt/canton/compose.yaml > canton-compose.yaml

# Конвертировать в K8s
kompose convert -f canton-compose.yaml
```

### Вариант 3: Использование Docker daemon на хосте
**Исследовать:**
- Можно ли монтировать `/var/run/docker.sock` с хоста в Pod?
- Security risks и mitigations
- Примеры в production (CI/CD pipelines)
- Альтернатива: containerd socket вместо docker

**Пример манифеста для исследования:**
```yaml
spec:
  containers:
  - name: canton-node
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
      type: Socket
```

### Вариант 4: Поиск альтернативных Canton образов/Helm charts
**Исследовать:**
- Официальные Canton Helm charts
- Digital Asset (разработчик Canton) Kubernetes deployments
- Community Helm charts для Canton Network
- GitHub repositories с production Canton K8s setups

**Где искать:**
- https://github.com/digital-asset/
- https://artifacthub.io (поиск "canton")
- Canton Network documentation
- Digital Asset Developers Portal

### Вариант 5: Запуск напрямую через docker compose на хосте
**Исследовать:**
- Запустить `docker compose` напрямую на сервере 65.108.15.30
- Управление через systemd unit
- Интеграция с Kubernetes для мониторинга
- Pros/Cons vs Kubernetes deployment

**Пример systemd unit:**
```ini
[Unit]
Description=Canton Validator
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/canton
ExecStart=/usr/bin/docker run --rm -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/themacroeconomicdao/canton-node:0.5.8 /opt/canton/start.sh -s https://sv.sv-1.dev... -o SECRET -p gyber-validator
ExecStop=/opt/canton/stop.sh

[Install]
WantedBy=multi-user.target
```

### Вариант 6: Nested Virtualization / KubeVirt
**Исследовать:**
- KubeVirt для запуска VM в Kubernetes
- Запустить Docker Compose внутри VM
- Overhead и complexity vs benefits

---

## 📊 КРИТЕРИИ ОЦЕНКИ РЕШЕНИЙ

**Приоритет 1: Security**
- Минимизация attack surface
- Избежать privileged containers если возможно
- Secure secret management

**Приоритет 2: Production Readiness**
- Stability и reliability
- Простота мониторинга и troubleshooting
- Disaster recovery capabilities

**Приоритет 3: Maintainability**
- Простота обновлений
- Понятность для DevOps команды
- Documentation quality

**Приоритет 4: Performance**
- Minimal overhead
- Resource efficiency
- Network latency

---

## 🎓 ИССЛЕДОВАТЕЛЬСКИЕ ШАГИ

1. **Literature Review (30 мин)**
   - Поиск "[Canton Network Kubernetes deployment](https://www.google.com/search?q=Canton+Network+Kubernetes+deployment)"
   - Поиск "[Docker Compose in Kubernetes production](https://www.google.com/search?q=Docker+Compose+in+Kubernetes+production)"
   - Поиск "[Docker-in-Docker Kubernetes security](https://www.google.com/search?q=Docker-in-Docker+Kubernetes+security+best+practices)"

2. **Official Documentation (20 мин)**
   - Digital Asset Canton documentation
   - Canton Network DevNet setup guides
   - Kubernetes official docs on DinD

3. **Community Resources (20 мин)**
   - GitHub Issues в Canton repositories
   - Stack Overflow questions
   - Reddit r/kubernetes discussions
   - CNCF Slack channels

4. **Proof of Concept Testing (опционально)**
   - Тестирование выбранного решения на dev окружении
   - Benchmark performance
   - Security audit

---

## 📝 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

**Детальный отчет включающий:**

1. **Рекомендуемое решение** с обоснованием выбора
2. **Step-by-step implementation guide**
3. **Готовые Kubernetes manifests / Helm values**
4. **Security considerations и mitigations**
5. **Monitoring и troubleshooting playbook**  
6. **Rollback plan**
7. **Links to all sources и references**

---

## 💡 ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ

**Текущие доступные ресурсы:**
- ✅ GHCR credentials (ghcr-creds secret)
- ✅ Canton Onboarding Secret
- ✅ k3s cluster с 1 node (65.108.15.30)
- ✅ hostNetwork capability
- ✅ Persistent volumes (local-path)

**Известные требования:**
- Валидатор ДОЛЖЕН использовать Public IP 65.108.15.30
- Нужен доступ к Canton DevNet API
- Необходима persistent storage для validator state
- SCAN API connectivity для синхронизации

**Финальная цель:**
Развернуть полностью функциональный Canton Validator на IP 65.108.15.30 который:
- Подключается к Canton DevNet
- Обрабатывает транзакции
- Стабильно работает 24/7
- Легко мониторится и обновляется

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ ЭТОТ ПРОМПТ

Скопируй весь текст выше и вставь в новый чат (Architect или Ask mode).
Попроси модель:

```
Проведи глубокое исследование всех вариантов решения, описанных выше.

Дай конкретные рекомендации с готовыми манифестами/командами для deployment.

Сфокусируйся на production-ready решении с минимальным security risk.
```

---

**Дата создания:** 27 ноября 2025  
**Версия:** 1.0  
**Автор:** DevOps Mode - Canton Validator Troubleshooting