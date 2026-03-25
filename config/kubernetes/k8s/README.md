# 🚀 Canton OTC - Kubernetes Deployment Guide

## 📋 Предварительные требования

1. **Kubectl** установлен и настроен
2. **GitHub Container Registry** доступ настроен
3. **Все переменные окружения** подготовлены
4. **DNS A-запись** для 1otc.cc указывает на IP вашего кластера 
(45.9.41.209)

## 🔐 Шаг 1: Создание Secrets

Создайте файл `.env.production` с вашими реальными значениями:

```bash
# Скопируйте из .env.example и заполните реальными данными
nano .env.production
```

Затем создайте secret в Kubernetes:

```bash
# Создайте namespace
kubectl apply -f namespace.yaml

# Создайте secret из .env файла
kubectl create secret generic canton-otc-secrets \
  --namespace=canton-otc \
  --from-env-file=.env.production

# Проверьте что secret создан
kubectl get secrets -n canton-otc
```

**Альтернативный способ** - создание secret вручную:

```bash
# Каждое значение нужно закодировать в base64
echo -n "your_value" | base64

# Создайте файл secret.yaml на основе secret.template.yaml
# Замените все <base64_encoded_value> на реальные закодированные значения

kubectl apply -f secret.yaml -n canton-otc
```

## 🐳 Шаг 2: Настройка GitHub Container Registry

Создайте GitHub Personal Access Token с правами `read:packages`:

```bash
# Создайте secret для pull image из GHCR
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --namespace=canton-otc
```

## 🚀 Шаг 3: Деплой приложения

```bash
# Примените все манифесты
kubectl apply -f namespace.yaml
kubectl apply -f service.yaml
kubectl apply -f deployment.yaml
kubectl apply -f ingress.yaml

# Проверьте статус деплоя
kubectl get all -n canton-otc

# Следите за логами
kubectl logs -f deployment/canton-otc -n canton-otc
```

## ✅ Шаг 4: Проверка деплоя

```bash
# Проверьте pods
kubectl get pods -n canton-otc

# Проверьте service
kubectl get svc -n canton-otc

# Проверьте ingress
kubectl get ingress -n canton-otc

# Проверьте сертификат SSL (если используется cert-manager)
kubectl get certificate -n canton-otc

# Проверьте health endpoint
curl -k https://1otc.cc/api/health
```

## 🔄 Обновление приложения

GitHub Actions автоматически задеплоит при push в `main` ветку.

**Ручное обновление:**

```bash
# Пересоздать deployment (pull latest image)
kubectl rollout restart deployment/canton-otc -n canton-otc

# Следить за rollout
kubectl rollout status deployment/canton-otc -n canton-otc
```

## 📊 Мониторинг

```bash
# Логи приложения
kubectl logs -f deployment/canton-otc -n canton-otc

# Логи конкретного пода
kubectl logs -f <pod-name> -n canton-otc

# Информация о pod
kubectl describe pod <pod-name> -n canton-otc

# События в namespace
kubectl get events -n canton-otc --sort-by='.lastTimestamp'
```

## 🐛 Траблшутинг

### Проблема: ImagePullBackOff

```bash
# Проверьте secret для GHCR
kubectl get secret ghcr-secret -n canton-otc

# Пересоздайте secret
kubectl delete secret ghcr-secret -n canton-otc
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --namespace=canton-otc
```

### Проблема: CrashLoopBackOff

```bash
# Проверьте логи
kubectl logs deployment/canton-otc -n canton-otc --previous

# Проверьте secrets
kubectl get secret canton-otc-secrets -n canton-otc -o yaml
```

### Проблема: Ingress не работает

```bash
# Проверьте ingress controller
kubectl get pods -n ingress-nginx

# Проверьте ingress
kubectl describe ingress canton-otc-ingress -n canton-otc

# Проверьте cert-manager (если используется)
kubectl get certificate -n canton-otc
kubectl describe certificate canton-otc-tls -n canton-otc
```

## 🔒 Обновление Secrets

```bash
# Удалить старый secret
kubectl delete secret canton-otc-secrets -n canton-otc

# Создать новый
kubectl create secret generic canton-otc-secrets \
  --namespace=canton-otc \
  --from-env-file=.env.production

# Перезапустить deployment
kubectl rollout restart deployment/canton-otc -n canton-otc
```

## 📈 Масштабирование

```bash
# Увеличить количество реплик
kubectl scale deployment canton-otc --replicas=3 -n canton-otc

# Или отредактировать deployment.yaml и применить
kubectl apply -f deployment.yaml
```

## 🗑️ Удаление

```bash
# Удалить все ресурсы
kubectl delete namespace canton-otc

# Или удалить по отдельности
kubectl delete -f ingress.yaml
kubectl delete -f deployment.yaml
kubectl delete -f service.yaml
kubectl delete secret ghcr-secret -n canton-otc
kubectl delete secret canton-otc-secrets -n canton-otc
kubectl delete -f namespace.yaml
```

## 🎯 Быстрый деплой (одной командой)

```bash
# Создать все сразу
kubectl apply -f namespace.yaml && \
kubectl create secret generic canton-otc-secrets --namespace=canton-otc --from-env-file=.env.production --dry-run=client -o yaml | kubectl apply -f - && \
kubectl create secret docker-registry ghcr-secret --docker-server=ghcr.io --docker-username=YOUR_GITHUB_USERNAME --docker-password=YOUR_GITHUB_TOKEN --namespace=canton-otc --dry-run=client -o yaml | kubectl apply -f - && \
kubectl apply -f service.yaml && \
kubectl apply -f deployment.yaml && \
kubectl apply -f ingress.yaml && \
kubectl rollout status deployment/canton-otc -n canton-otc
```

---

**✅ После успешного деплоя приложение будет доступно на:**
- https://1otc.cc
- https://www.1otc.cc

