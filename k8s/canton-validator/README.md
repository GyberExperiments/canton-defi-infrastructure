# Kubernetes интеграция для Canton Validator Nginx

## Описание

Этот набор манифестов интегрирует Docker Nginx контейнер (`splice-validator-nginx-1`) с Kubernetes кластером через Traefik Ingress Controller.

## Архитектура

```
Internet → Traefik Ingress (порт 80) → K8s Service → K8s Endpoints → Docker Nginx (порт 8080) → Wallet/ANS UI
```

## Файлы

### Манифесты Kubernetes
- `nginx-service.yaml` - Kubernetes Service и Endpoints для подключения к Docker контейнеру
- `nginx-ingress.yaml` - Traefik Ingress с правилами маршрутизации

### Скрипты
- `apply.sh` - Безопасное применение манифестов с проверками и backup
- `backup.sh` - Создание backup перед применением изменений
- `update-nginx-endpoints.sh` - Автоматическое обновление IP адреса контейнера в Endpoints
- `diagnose.sh` - Полная диагностика интеграции и проверка работоспособности

## Предварительные требования

1. **Kubernetes кластер** с Traefik Ingress Controller
2. **Docker Compose стек** с nginx контейнером на сервере `65.108.15.30`
3. **Nginx контейнер** должен быть доступен на порту `8080:80` (изменено с `80:80`)
4. **Доступ к кластеру** через `kubectl`

## Установка

### Шаг 1: Проверка текущего состояния

```bash
# Проверить Kubernetes кластер
kubectl cluster-info
kubectl get nodes -o wide
kubectl get ingressclass

# Проверить Traefik
kubectl get svc -A | grep traefik
kubectl get pods -A | grep traefik

# Проверить Docker контейнер
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "docker ps | grep nginx"
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "docker network inspect splice-validator_splice_validator --format '{{range .Containers}}{{if eq .Name \"splice-validator-nginx-1\"}}{{.IPv4Address}}{{end}}{{end}}'"
```

### Шаг 2: Получить IP адрес nginx контейнера

```bash
NGINX_IP=$(ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 \
  "docker network inspect splice-validator_splice_validator --format '{{range .Containers}}{{if eq .Name \"splice-validator-nginx-1\"}}{{.IPv4Address}}{{end}}{{end}}' | cut -d'/' -f1")

echo "Nginx IP: $NGINX_IP"
```

### Шаг 3: Обновить Endpoints с реальным IP

Отредактируйте `nginx-service.yaml` и замените IP в Endpoints:

```yaml
subsets:
- addresses:
  - ip: <ВАШ_IP_АДРЕС>  # Замените на реальный IP
```

Или используйте скрипт после применения манифестов (см. ниже).

### Шаг 4: Создать backup (рекомендуется)

```bash
cd k8s/canton-validator
./backup.sh
```

### Шаг 5: Применить манифесты

**Вариант A: Использовать скрипт apply.sh (рекомендуется)**

```bash
cd k8s/canton-validator

# Dry-run для проверки
./apply.sh --dry-run

# Применить манифесты (автоматически создаст backup и обновит IP)
./apply.sh
```

**Вариант B: Применить вручную**

```bash
# Dry-run для проверки
kubectl apply --dry-run=client -f k8s/canton-validator/nginx-service.yaml
kubectl apply --dry-run=client -f k8s/canton-validator/nginx-ingress.yaml

# Применить
kubectl apply -f k8s/canton-validator/nginx-service.yaml
kubectl apply -f k8s/canton-validator/nginx-ingress.yaml

# Обновить IP адрес в Endpoints
./k8s/canton-validator/update-nginx-endpoints.sh
```

## Проверка

### Быстрая диагностика

Используйте скрипт диагностики для полной проверки:

```bash
cd k8s/canton-validator
./diagnose.sh
```

Скрипт проверит:
- ✅ Доступность Kubernetes кластера
- ✅ Наличие Traefik Ingress Controller
- ✅ Статус Docker контейнера nginx
- ✅ IP адрес контейнера
- ✅ Kubernetes ресурсы (Service, Endpoints, Ingress)
- ✅ Сетевая доступность
- ✅ Доступность через Ingress
- ✅ Логи Traefik

### Проверить созданные ресурсы

```bash
kubectl get svc canton-validator-nginx
kubectl get endpoints canton-validator-nginx
kubectl get ingress canton-validator-ingress
kubectl describe ingress canton-validator-ingress
```

### Проверить доступность

```bash
# Health check
curl -I http://65.108.15.30/health

# Wallet UI
curl -I http://65.108.15.30/wallet/

# ANS UI
curl -I http://65.108.15.30/ans/

# Validator API
curl -I http://65.108.15.30/api
```

### Проверить логи

```bash
# Логи Traefik
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=20

# Логи nginx контейнера
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "docker logs splice-validator-nginx-1 --tail=20"
```

### Проверить подключение Service → Endpoints

```bash
# Из Kubernetes pod
kubectl run test-curl --image=curlimages/curl --rm -it --restart=Never -- \
  sh -c "curl -s http://canton-validator-nginx.default.svc.cluster.local/health"
```

## Автоматическое обновление Endpoints

Если IP адрес nginx контейнера меняется при перезапуске, используйте скрипт:

```bash
# Ручной запуск
cd k8s/canton-validator
./update-nginx-endpoints.sh

# Или через cron (каждые 5 минут)
*/5 * * * * cd /path/to/k8s/canton-validator && ./update-nginx-endpoints.sh
```

**Примечание:** Скрипт автоматически определяет текущий IP контейнера и обновляет Endpoints только если IP изменился.

## Устранение неполадок

### Проблема: Endpoints не подключается к контейнеру

**Решение:**
1. Проверить IP адрес контейнера:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 \
     "docker network inspect splice-validator_splice_validator --format '{{range .Containers}}{{if eq .Name \"splice-validator-nginx-1\"}}{{.IPv4Address}}{{end}}{{end}}'"
   ```

2. Проверить доступность из Kubernetes pod:
   ```bash
   kubectl run test-pod --image=curlimages/curl --rm -it --restart=Never -- \
     sh -c "curl -s -m 2 http://<NGINX_IP>:8080/health || echo 'FAILED'"
   ```

3. Если недоступно, попробовать использовать host IP:
   - Изменить Endpoints на `65.108.15.30:8080` (если Traefik использует hostNetwork)

### Проблема: Ingress возвращает 404

**Решение:**
1. Проверить правила Ingress:
   ```bash
   kubectl describe ingress canton-validator-ingress
   ```

2. Проверить, что Service правильно подключен:
   ```bash
   kubectl get endpoints canton-validator-nginx -o yaml
   ```

3. Проверить логи Traefik:
   ```bash
   kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=50
   ```

### Проблема: Запросы не доходят до nginx

**Решение:**
1. Проверить, что nginx контейнер слушает на порту 8080:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "docker ps | grep nginx"
   # Должно быть: 0.0.0.0:8080->80/tcp
   ```

2. Проверить доступность изнутри контейнера:
   ```bash
   ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 \
     "docker exec splice-validator-nginx-1 curl -s http://127.0.0.1/health"
   ```

## Откат изменений

Если что-то пошло не так:

```bash
# Удалить созданные ресурсы
kubectl delete ingress canton-validator-ingress -n default
kubectl delete svc canton-validator-nginx -n default
kubectl delete endpoints canton-validator-nginx -n default 2>/dev/null || true

# Восстановить из backup (если был создан)
cd k8s/canton-validator
kubectl apply -f backups/k8s-canton-validator-backup-YYYYMMDD_HHMMSS.yaml
```

### Проверка после отката:

```bash
# Убедиться, что другие сервисы работают
kubectl get ingress -A
curl -I http://65.108.15.30/  # Проверить другие сервисы
```

## Чеклист реализации

- [x] Шаг 1: Диагностика выполнена (используйте `./diagnose.sh`)
- [x] Шаг 2: Архитектура изучена
- [x] Шаг 3: Решение спроектировано
- [x] Шаг 4: Манифесты созданы и проверены (dry-run)
- [ ] Шаг 5: Backup создан (используйте `./backup.sh`)
- [ ] Шаг 6: Манифесты применены (используйте `./apply.sh`)
- [ ] Шаг 7: Тестирование выполнено (используйте `./diagnose.sh`)
- [ ] Шаг 8: Все endpoints работают (200 OK)
- [ ] Шаг 9: Логи проверены
- [ ] Шаг 10: Другие сервисы не пострадали
- [x] Шаг 11: Документация создана
- [x] Шаг 12: Скрипт обновления Endpoints создан

## Дополнительная информация

- [Полный промпт интеграции](../../blockchain/COMPLETE_NGINX_K8S_INTEGRATION_PROMPT.md)
- [Диагностика проблемы порта 80](../../blockchain/NGINX_PORT_80_CONFLICT_DIAGNOSIS.md)
- [Быстрое решение (порт 8080)](../../blockchain/NGINX_FIX_PORT_80_QUICK_FIX.md)





