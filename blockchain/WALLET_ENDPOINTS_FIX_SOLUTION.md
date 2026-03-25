# 🔧 РЕШЕНИЕ: Wallet Endpoints 404 - Правильный подход

**Дата:** 2025-11-29  
**Статус:** Требуется изменение архитектуры deployment

---

## 🔍 КРИТИЧЕСКАЯ ПРОБЛЕМА

Согласно документам (`CANTON_VALIDATOR_DEPLOYMENT_STATUS_2025_11_27.md`):

**Отдельные образы `canton-participant:0.5.8` и `validator-app:0.5.8` НЕ доступны в GHCR публично!**

Они используются только внутри образа `canton-node:0.5.8` через Docker Compose.

**Текущий манифест `canton-validator-full-stack.yaml` пытается использовать несуществующие образы:**
- ❌ `ghcr.io/themacroeconomicdao/canton-participant:0.5.8` - не существует
- ❌ `ghcr.io/themacroeconomicdao/validator-app:0.5.8` - не существует

---

## ✅ ЧТО УЖЕ СДЕЛАНО

1. ✅ **Конфигурация `ADDITIONAL_CONFIG_WALLET` добавлена** в манифест
2. ✅ **Секрет `ghcr-creds` обновлен** с актуальным GitHub token
3. ✅ **Манифест применен** в кластер

---

## 🎯 ПРАВИЛЬНОЕ РЕШЕНИЕ

Согласно документам, есть несколько вариантов:

### Вариант 1: Использовать образ `canton-node:0.5.8` с Docker socket (РЕКОМЕНДУЕТСЯ)

Образ `canton-node:0.5.8` содержит все компоненты через Docker Compose. Нужно:
1. Использовать образ `ghcr.io/themacroeconomicdao/canton-node:0.5.8`
2. Монтировать Docker socket с хоста: `/var/run/docker.sock`
3. Образ запустит все компоненты через Docker Compose внутри

**Плюсы:**
- Использует существующий образ
- Все компоненты работают как задумано
- Wallet endpoints будут доступны

**Минусы:**
- Security risk (доступ к host Docker socket)
- Контейнеры создаются на хосте, а не в Pod

### Вариант 2: Docker-in-Docker (DinD)

Запуск Docker daemon внутри Kubernetes Pod.

**Плюсы:**
- Изоляция от хоста
- Использует существующий образ

**Минусы:**
- Требует privileged container
- Performance overhead

### Вариант 3: Запуск на хосте через systemd (вне K8s)

Запустить Docker Compose напрямую на сервере 65.108.15.30.

**Плюсы:**
- Самое простое решение
- Работает гарантированно

**Минусы:**
- Теряются преимущества Kubernetes

---

## 🚀 РЕКОМЕНДУЕМЫЙ ПЛАН

### Шаг 1: Проверить, существуют ли образы

```bash
# Попробовать загрузить образы напрямую
docker pull ghcr.io/themacroeconomicdao/validator-app:0.5.8
docker pull ghcr.io/themacroeconomicdao/canton-participant:0.5.8
```

Если образы не существуют → использовать Вариант 1 или 3.

### Шаг 2: Если образы не существуют - использовать canton-node

Создать новый манифест на основе `canton-node:0.5.8` с монтированием Docker socket:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: canton-node
  namespace: canton-node
spec:
  replicas: 1
  template:
    spec:
      hostNetwork: true
      containers:
      - name: canton-node
        image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
        volumeMounts:
        - name: docker-sock
          mountPath: /var/run/docker.sock
        - name: canton-data
          mountPath: /opt/canton/data
        env:
        - name: ADDITIONAL_CONFIG_WALLET
          value: |
            canton.validator-apps.validator_backend {
              enable-wallet = true
              validator-wallet-users = [wallet-admin]
              admin-api {
                port = 5003
                address = "0.0.0.0"
              }
            }
      volumes:
      - name: docker-sock
        hostPath:
          path: /var/run/docker.sock
      - name: canton-data
        hostPath:
          path: /opt/canton-validator/data
```

### Шаг 3: Альтернатива - запуск на хосте

Если Kubernetes deployment не работает, запустить напрямую на хосте:

```bash
ssh root@65.108.15.30

# Создать директорию
mkdir -p /opt/canton-validator && cd /opt/canton-validator

# Запустить через Docker
docker run -d \
  --name canton-validator \
  --restart unless-stopped \
  --network host \
  -e SPONSOR_SV_ADDRESS="https://sv.sv-1.dev.global.canton.network.sync.global" \
  -e ONBOARDING_SECRET="$ONBOARDING_SECRET" \
  -e PARTY_HINT="gyber-validator" \
  -e MIGRATION_ID="0" \
  -e ADDITIONAL_CONFIG_WALLET="canton.validator-apps.validator_backend { enable-wallet = true; validator-wallet-users = [wallet-admin]; admin-api { port = 5003; address = \"0.0.0.0\"; } }" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/canton-validator/data:/opt/canton/data \
  -v /opt/canton-validator/logs:/opt/canton/logs \
  ghcr.io/themacroeconomicdao/canton-node:0.5.8
```

---

## 📝 ТЕКУЩИЙ СТАТУС

1. ✅ Конфигурация `ADDITIONAL_CONFIG_WALLET` добавлена в манифест
2. ✅ Секрет `ghcr-creds` обновлен
3. ❌ Deployment не работает - образы не существуют
4. ⏳ Требуется изменить архитектуру deployment

---

## 🔗 ССЫЛКИ НА ДОКУМЕНТАЦИЮ

- `blockchain/CANTON_VALIDATOR_DEPLOYMENT_STATUS_2025_11_27.md` - детальный анализ проблемы
- `blockchain/COMPLETE_CANTON_VALIDATOR_DEPLOYMENT_GUIDE.md` - полное руководство
- `blockchain/RESEARCH_CANTON_K8S_DEPLOYMENT.md` - исследовательский промпт с вариантами решения

---

**Следующий шаг:** Решить, какой вариант использовать (рекомендуется Вариант 1 или 3)





