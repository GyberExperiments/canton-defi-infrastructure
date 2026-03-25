# 🔧 Диагностика: Контейнер Canton Валидатора не запущен

## 🔍 Первая проверка

```bash
# Посмотреть статус Pod'а
kubectl get pods -n canton-node -o wide

# Проверить описание Pod'а
kubectl describe pod -n canton-node canton-node-new-0

# Посмотреть логи контейнера
kubectl logs -n canton-node canton-node-new-0

# Посмотреть ошибки запуска
kubectl logs -n canton-node canton-node-new-0 --previous
```

## ❌ Вероятные проблемы

### Проблема 1: ConfigMap canton-config не создан
```bash
# Проверить
kubectl get configmap -n canton-node

# Если не создан - это проблема!
# Нужно создать ConfigMap с конфигом Canton
```

### Проблема 2: Образ неправильный или требует docker
```bash
# Попробуем простой образ Ubuntu с инструментами
# Заменим образ на более простой вариант
```

### Проблема 3: Security Context блокирует запуск
```bash
# Попробуем запустить как root (временно для отладки)
```

---

## ✅ Решение 1: Создать ConfigMap

```bash
# Создайте ConfigMap с конфигурацией Canton
kubectl create configmap canton-config \
  --from-file=blockchain/config/canton.conf \
  --from-file=blockchain/config/validator.conf \
  -n canton-node

# Проверить что создан
kubectl get configmap -n canton-node
```

---

## ✅ Решение 2: Упрощенный образ для запуска

Создаю новый более простой yaml для тестирования:

```bash
cat > /tmp/canton-validator-simple.yaml << 'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: canton-node-new-0
  namespace: canton-node
spec:
  hostNetwork: true
  nodeSelector:
    kubernetes.io/hostname: "canton-node-65-108-15-30"
  containers:
  - name: canton-validator
    image: ghcr.io/themacroeconomicdao/canton-node:0.5.8
    imagePullPolicy: Always
    command: ["/bin/bash", "-c"]
    args:
      - |
        echo "Canton Validator запускается..."
        echo "IP: $(curl -s http://checkip.amazonaws.com)"
        echo "Onboarding Secret: $ONBOARDING_SECRET"
        
        # Попытка запустить валидатор
        if [ -f /opt/canton/bin/canton ]; then
          echo "Запуск Canton бинарника..."
          /opt/canton/bin/canton --version
        elif [ -f /opt/canton/start.sh ]; then
          echo "Запуск start.sh..."
          bash /opt/canton/start.sh
        else
          echo "Canton бинарник не найден, листинг /opt/canton:"
          ls -la /opt/canton/ || echo "Директория не существует"
          sleep 3600
        fi
    env:
    - name: ONBOARDING_SECRET
      valueFrom:
        secretKeyRef:
          name: canton-onboarding
          key: ONBOARDING_SECRET
    - name: CANTON_API
      value: "https://sv.sv-1.dev.global.canton.network.sync.global"
    volumeMounts:
    - name: canton-data
      mountPath: /opt/canton/data
  volumes:
  - name: canton-data
    hostPath:
      path: /var/lib/canton/data
      type: DirectoryOrCreate
  restartPolicy: Never
EOF

# Применить
kubectl apply -f /tmp/canton-validator-simple.yaml

# Смотреть логи
kubectl logs -n canton-node canton-node-new-0 -f
```

---

## ✅ Решение 3: Проверить образ напрямую

```bash
# Запустить контейнер интерактивно для изучения
kubectl run -it --rm -n canton-node \
  --image=ghcr.io/themacroeconomicdao/canton-node:0.5.8 \
  --overrides='{"spec":{"restartPolicy":"Never"}}' \
  canton-debug -- /bin/bash

# Внутри контейнера:
ls -la /opt/canton/
ls -la /opt/canton/bin/
cat /opt/canton/start.sh
echo $ONBOARDING_SECRET
```

---

## 🔍 Проверка почему не запускается

```bash
# 1. Проверить что ConfigMap создан
kubectl describe configmap -n canton-node canton-config

# 2. Проверить что Secret создан
kubectl describe secret -n canton-node canton-onboarding

# 3. Посмотреть события Pod'а
kubectl describe pod -n canton-node canton-node-new-0 | grep -A 20 "Events"

# 4. Посмотреть все события в namespace
kubectl get events -n canton-node
```

---

## 📝 Чек-лист перед запуском

- [ ] Namespace `canton-node` создан
- [ ] Secret `canton-onboarding` создан и содержит правильный secret
- [ ] ConfigMap `canton-config` создан
- [ ] Нода `canton-node-65-108-15-30` существует и здорова
- [ ] Pod может быть scheduled на эту ноду

Проверь:
```bash
kubectl get ns canton-node
kubectl get secret -n canton-node canton-onboarding
kubectl get configmap -n canton-node canton-config
kubectl get node canton-node-65-108-15-30
kubectl describe node canton-node-65-108-15-30
```

---

## 🆘 Если ничего не помогает

Попробуй запустить диагностический Pod:

```bash
kubectl run -it --rm -n canton-node \
  --image=curlimages/curl \
  --overrides='{"spec":{"nodeSelector":{"kubernetes.io/hostname":"canton-node-65-108-15-30"},"restartPolicy":"Never"}}' \
  diag -- /bin/sh

# Внутри:
echo "IP ноды:"
curl -s http://checkip.amazonaws.com
echo ""
echo "Сетевые портаы:"
netstat -tlnp 2>/dev/null || echo "netstat не доступен"
echo ""
echo "Процессы:"
ps aux | grep -i canton
```
