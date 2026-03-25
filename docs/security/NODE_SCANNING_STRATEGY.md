# Стратегия проверки нод через kubectl

## Анализ возможностей kubectl

### Что МОЖЕМ делать через kubectl:

1. **kubectl debug node** с опциями:
   - `--profile=sysadmin` - privileged доступ
   - `--image=ubuntu` - использовать образ с пакетным менеджером
   - Хостовая файловая система монтируется в `/host`
   - Можно выполнять команды через `chroot /host`

2. **Проверка подов:**
   - `kubectl exec` - выполнение команд в подах
   - `kubectl logs` - просмотр логов
   - `kubectl describe` - детальная информация

3. **Проверка кластера:**
   - `kubectl get` - все ресурсы
   - `kubectl get pods --all-namespaces --field-selector spec.nodeName=node-name` - поды на конкретной ноде

### Что НЕ МОЖЕМ делать напрямую:

1. **Установка пакетов на хост:**
   - ClamAV, rkhunter, chkrootkit нужно устанавливать на хост или в контейнер
   - kubectl debug node создаёт временный контейнер

2. **Запуск системных сервисов:**
   - Не можем запустить systemd services через контейнер
   - Не можем проверить cron jobs напрямую (нужен доступ к /var/spool/cron)

3. **Полный доступ к /proc, /sys:**
   - Ограниченный доступ через контейнер
   - Нужен privileged режим

## Решения для нашей ситуации

### Вариант 1: kubectl debug node с privileged доступом (РЕКОМЕНДУЕТСЯ)

**Преимущества:**
- Не требует SSH доступа
- Работает через kubectl
- Можно использовать образы с предустановленными инструментами

**Как работает:**
```bash
# 1. Использовать образ с предустановленными инструментами
kubectl debug node/NODE_NAME -it \
  --image=ubuntu:latest \
  --profile=sysadmin \
  -- sh -c "chroot /host bash -c 'apt-get update && apt-get install -y clamav rkhunter chkrootkit && freshclam && clamscan -r -i /tmp'"

# 2. Или использовать готовый образ с инструментами
kubectl debug node/NODE_NAME -it \
  --image=some-security-image:latest \
  --profile=sysadmin \
  -- sh -c "chroot /host /path/to/scan-script.sh"
```

**Ограничения:**
- Установка пакетов занимает время
- Нужен интернет на ноде для apt-get
- Временный контейнер удаляется после завершения

### Вариант 2: DaemonSet с privileged контейнером

**Преимущества:**
- Постоянное сканирование
- Можно настроить расписание
- Результаты сохраняются в поде

**Недостатки:**
- Требует создания манифеста
- Privileged контейнер - security risk
- Нужно управлять DaemonSet

**Как работает:**
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-security-scanner
spec:
  selector:
    matchLabels:
      app: node-scanner
  template:
    metadata:
      labels:
        app: node-scanner
    spec:
      hostPID: true
      hostNetwork: true
      containers:
      - name: scanner
        image: ubuntu:latest
        securityContext:
          privileged: true
        volumeMounts:
        - name: host-root
          mountPath: /host
        command: ["/bin/bash"]
        args: ["-c", "chroot /host /path/to/scan.sh"]
      volumes:
      - name: host-root
        hostPath:
          path: /
```

### Вариант 3: Гибридный подход (ОПТИМАЛЬНЫЙ)

**Комбинация:**
1. **Быстрая проверка через kubectl debug node:**
   - Проверка процессов
   - Проверка файлов в /tmp
   - Проверка сетевых соединений
   - Поиск конкретных угроз (javae, XFZSrI)

2. **Полное сканирование через DaemonSet:**
   - ClamAV полное сканирование
   - rkhunter проверка
   - chkrootkit проверка
   - Lynis аудит

## Рекомендуемый подход для нашей ситуации

### Этап 1: Быстрая проверка всех нод (kubectl debug node)

**Что проверяем:**
- Процессы (ps aux)
- Файлы в /tmp (find /tmp)
- Сетевые соединения (netstat/ss)
- Cron jobs (через /var/spool/cron)
- Systemd services (через systemctl в chroot)

**Команды:**
```bash
# Для каждой ноды
kubectl debug node/NODE_NAME -it \
  --image=ubuntu:latest \
  --profile=sysadmin \
  -- sh -c "chroot /host bash -c 'ps aux | grep -E \"(javae|XFZSrI|miner)\" || echo OK'"
```

### Этап 2: Полное сканирование (DaemonSet или Job)

**Для установки инструментов и полного сканирования:**
- Создать DaemonSet с privileged контейнером
- Или использовать Job для разового сканирования
- Сохранять результаты в ConfigMap или PersistentVolume

## Конкретный план действий

### Шаг 1: Быстрая проверка через kubectl debug node

**Проверяем:**
1. Процессы на хосте
2. Файлы в /tmp (javae, XFZSrI)
3. Сетевые соединения
4. Недавно изменённые файлы

**Используем:**
- `kubectl debug node` с `--profile=sysadmin`
- Хост монтируется в `/host`
- Команды через `chroot /host`

### Шаг 2: Установка инструментов и полное сканирование

**Вариант A: Через kubectl debug node (разовое)**
- Установить инструменты в chroot /host
- Запустить сканирование
- Сохранить результаты

**Вариант B: Через DaemonSet (постоянное)**
- Создать DaemonSet с инструментами
- Настроить расписание сканирования
- Сохранять результаты

## Ограничения и компромиссы

### Что мы МОЖЕМ проверить через kubectl:
✅ Процессы на хосте (через hostPID)
✅ Файлы на хосте (через hostPath mount)
✅ Сетевые соединения (через hostNetwork)
✅ Системные логи (через /host/var/log)
✅ Cron jobs (через /host/var/spool/cron)

### Что мы НЕ МОЖЕМ проверить напрямую:
❌ Systemd services (нужен systemd в контейнере)
❌ Установленные пакеты (нужен доступ к dpkg/rpm)
❌ Полный доступ к /proc, /sys (ограничения контейнера)

### Компромиссы:
⚠️ Установка инструментов занимает время
⚠️ Privileged контейнеры - security risk
⚠️ Нужен интернет на ноде для установки пакетов

## Итоговое решение

**Для нашей ситуации оптимально:**

1. **Немедленная проверка (kubectl debug node):**
   - Проверить процессы
   - Найти файлы javae, XFZSrI
   - Проверить сетевые соединения
   - Это можно сделать СЕЙЧАС через kubectl

2. **Полное сканирование (DaemonSet или Job):**
   - Установить ClamAV, rkhunter, chkrootkit
   - Запустить полное сканирование
   - Сохранить результаты
   - Это требует создания DaemonSet/Job

**Вывод:** 
- kubectl debug node отлично подходит для быстрой проверки конкретных угроз
- Для полного сканирования лучше использовать DaemonSet или Job
- Можно комбинировать оба подхода







