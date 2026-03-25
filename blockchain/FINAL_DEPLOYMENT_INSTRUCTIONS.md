# 🎯 ФИНАЛЬНЫЕ ИНСТРУКЦИИ: Canton Validator - Запуск и Управление

## ✅ ТЕКУЩИЙ СТАТУС

**Canton Validator успешно запущен!** 🎉

**Используемый образ:** `canton-node-fixed:latest` (локальный, с поддержкой jq)  
**Сервер:** 65.108.15.30  
**Статус:** Работает и готов к использованию

---

## 📋 ЧТО УЖЕ СДЕЛАНО

✅ Образ собран локально: `canton-node-fixed:latest`  
✅ Образ содержит все необходимое: canton-node + jq  
✅ Валидатор запущен в контейнере `canton-validator`  
✅ Скрипт развертывания выполнен успешно

---

## 🔐 ЧАСТЬ 1: НАСТРОЙКА SSH БЕЗ ПАРОЛЯ (macOS)

### Шаг 1: Генерация SSH ключа

```bash
# Проверяем наличие существующего ключа
ls -la ~/.ssh/id_rsa.pub

# Если ключа нет - создаем новый
ssh-keygen -t rsa -b 4096 -C "canton-validator" -f ~/.ssh/id_rsa
# Нажмите Enter для пустой парольной фразы
```

### Шаг 2: Копирование ключа на сервер

```bash
# Копируем публичный ключ на сервер
ssh-copy-id root@65.108.15.30
# Пароль: $CANTON_PASSWORD

# Или вручную:
cat ~/.ssh/id_rsa.pub | ssh root@65.108.15.30 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### Шаг 3: Проверка

```bash
# Тестируем подключение БЕЗ пароля
ssh root@65.108.15.30 "echo 'SSH работает без пароля!'"

# Должно вывести текст БЕЗ запроса пароля
```

### Шаг 4: Настройка SSH config (опционально)

```bash
# Добавляем алиас для удобства
cat >> ~/.ssh/config << 'EOF'

Host canton
    HostName 65.108.15.30
    User root
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
EOF

chmod 600 ~/.ssh/config

# Теперь можно: ssh canton
```

---

## 🚀 ЧАСТЬ 2: УПРАВЛЕНИЕ ВАЛИДАТОРОМ

### Основные команды

```bash
# Подключение к серверу
ssh root@65.108.15.30

# Просмотр логов в реальном времени
docker logs -f canton-validator

# Просмотр последних 100 строк логов
docker logs --tail=100 canton-validator

# Проверка статуса контейнера
docker ps | grep canton-validator

# Проверка внутренних сервисов
docker exec canton-validator docker ps

# Просмотр использования ресурсов
docker stats --no-stream canton-validator
```

### Перезапуск валидатора

```bash
# Мягкий перезапуск
docker restart canton-validator

# Полная остановка и запуск
docker stop canton-validator
docker start canton-validator

# Проверка что перезапустился
docker ps | grep canton-validator
```

### Остановка валидатора

```bash
# Остановка контейнера
docker stop canton-validator

# Полное удаление (если нужно пересоздать)
docker stop canton-validator
docker rm canton-validator
```

---

## 📊 ЧАСТЬ 3: МОНИТОРИНГ И ДИАГНОСТИКА

### Health Checks

```bash
# Проверка портов
ssh root@65.108.15.30 "netstat -tlnp | grep -E '8080|8081|8082'"

# Проверка что сервисы внутри запущены
ssh root@65.108.15.30 "docker exec canton-validator docker ps"

# Проверка логов на ошибки
ssh root@65.108.15.30 "docker logs canton-validator 2>&1 | grep -i 'error\|failed\|exception' | tail -20"
```

### Создание скрипта мониторинга

На сервере создайте файл `/root/monitor-validator.sh`:

```bash
ssh root@65.108.15.30 'cat > /root/monitor-validator.sh' << 'EOF'
#!/bin/bash

while true; do
  clear
  echo "=== Canton Validator Monitor - $(date) ==="
  echo ""
  
  echo "📦 Main Container:"
  docker ps --filter name=canton-validator --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  
  echo ""
  echo "🔧 Internal Services:"
  docker exec canton-validator docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Cannot access internal services"
  
  echo ""
  echo "💾 Resource Usage:"
  docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep canton
  
  echo ""
  echo "📋 Recent Logs (last 5 lines):"
  docker logs canton-validator --tail=5 2>&1
  
  echo ""
  echo "Press Ctrl+C to exit | Refresh every 10 seconds"
  sleep 10
done
EOF

# Делаем исполняемым
ssh root@65.108.15.30 "chmod +x /root/monitor-validator.sh"

# Запускаем
ssh root@65.108.15.30 "/root/monitor-validator.sh"
```

---

## 🔄 ЧАСТЬ 4: ОБНОВЛЕНИЕ ONBOARDING SECRET

### DevNet Secret (действует 1 час)

```bash
# Получаем новый секрет
NEW_SECRET=$(curl -s -X POST \
  "https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare" \
  | jq -r '.onboarding_secret')

echo "Новый secret: ${NEW_SECRET:0:10}..."

# Перезапускаем валидатор с новым секретом
# (Точная команда зависит от того как первоначально запущен - нужно посмотреть docker inspect)
docker inspect canton-validator --format='{{.Config.Cmd}}'
```

### Сохранение команды запуска

```bash
# Сохраняем текущую команду запуска для справки
ssh root@65.108.15.30 "docker inspect canton-validator" > canton-validator-config.json

# Смотрим переменные окружения
ssh root@65.108.15.30 "docker inspect canton-validator --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'ONBOARDING|PARTY|CANTON'"
```

---

## 🔧 ЧАСТЬ 5: TROUBLESHOOTING

### Проблема: Контейнер не запускается

```bash
# Смотрим логи предыдущего запуска
ssh root@65.108.15.30 "docker logs canton-validator"

# Проверяем что образ существует
ssh root@65.108.15.30 "docker images | grep canton-node-fixed"

# Проверяем доступные ресурсы
ssh root@65.108.15.30 "free -h && df -h"
```

### Проблема: Внутренние сервисы не запускаются

```bash
# Заходим внутрь контейнера
ssh root@65.108.15.30 "docker exec -it canton-validator /bin/bash"

# Внутри контейнера:
# Проверяем Docker daemon
docker ps

# Проверяем логи Docker Compose
cat /opt/canton/logs/*.log

# Проверяем доступность Docker socket
ls -la /var/run/docker.sock
```

### Проблема: Истек onboarding secret

**Симптомы:**
- Логи показывают ошибки аутентификации
- "401 Unauthorized" или "Invalid secret"

**Решение:**
```bash
# 1. Получаем новый секрет (см. Часть 4)
# 2. Пересоздаем контейнер с новым секретом
# 3. Для DevNet это нормально - секрет действует 1 час
```

---

## 📚 ЧАСТЬ 6: ПОЛЕЗНАЯ ИНФОРМАЦИЯ

### Информация о сервере

```
IP: 65.108.15.30
User: root
Password: $GHCR_PASSWORD
```

### Используемый образ

```
Образ: canton-node-fixed:latest
Базовый образ: canton-node:0.5.8
Дополнения: jq + исправления
Расположение: Локальный (на сервере)
```

### Конфигурация валидатора

```
Network: DevNet
API: https://sv.sv-1.dev.global.canton.network.sync.global
Party Hint: gyber-validator
Migration ID: 0
```

### Сетевые порты

Стандартные порты Canton (если используется host network):
- `8080` - Canton API / Metrics
- `8081` - Health endpoint
- `8082` - Admin API
- `6865` - Ledger API

### Важные пути на сервере

```bash
# Логи валидатора (если смонтированы)
/var/lib/docker/volumes/canton-logs/_data/

# Данные валидатора (если смонтированы)
/var/lib/docker/volumes/canton-data/_data/

# Конфигурация (если есть)
/opt/canton-validator/
```

---

## 🎯 ЧАСТЬ 7: БЫСТРЫЕ КОМАНДЫ (ШПАРГАЛКА)

### Подключение и статус

```bash
# Подключение
ssh root@65.108.15.30

# Быстрая проверка статуса
ssh root@65.108.15.30 "docker ps | grep canton && docker exec canton-validator docker ps"

# Логи
ssh root@65.108.15.30 "docker logs --tail=50 canton-validator"
```

### Управление

```bash
# Перезапуск
ssh root@65.108.15.30 "docker restart canton-validator"

# Остановка
ssh root@65.108.15.30 "docker stop canton-validator"

# Запуск
ssh root@65.108.15.30 "docker start canton-validator"
```

### Диагностика

```bash
# Проверка ресурсов
ssh root@65.108.15.30 "docker stats --no-stream"

# Проверка образов
ssh root@65.108.15.30 "docker images | grep canton"

# Проверка сети
ssh root@65.108.15.30 "docker inspect canton-validator | grep -A 20 NetworkSettings"
```

---

## ✅ ЧАСТЬ 8: ЧЕКЛИСТ ПРОВЕРКИ

После выполнения всех шагов проверьте:

- [ ] SSH работает без пароля
- [ ] Можете просмотреть логи: `docker logs canton-validator`
- [ ] Контейнер в статусе "Up": `docker ps | grep canton-validator`
- [ ] Внутренние сервисы запущены: `docker exec canton-validator docker ps`
- [ ] Нет критических ошибок в логах
- [ ] Скрипт мониторинга работает
- [ ] Знаете как перезапустить валидатор
- [ ] Знаете как обновить onboarding secret

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

### Краткосрочные (1-7 дней)

1. **Мониторинг стабильности**
   - Следить за логами первые 24-48 часов
   - Проверять что валидатор не падает
   - Мониторить использование ресурсов

2. **Проверка whitelisting**
   - Убедиться что IP 65.108.15.30 в whitelist
   - Проверить connectivity к SCAN API
   - Проверить что нет ошибок 403/401

3. **Backup конфигурации**
   - Сохранить команду запуска контейнера
   - Задокументировать переменные окружения
   - Создать backup данных валидатора

### Среднесрочные (1-4 недели)

4. **Автоматизация**
   - Настроить systemd service для автозапуска
   - Создать скрипт автоматического renewal секрета
   - Настроить алерты на падение контейнера

5. **Migration на TestNet**
   - Запросить TestNet onboarding secret
   - Подготовить конфигурацию для TestNet
   - Протестировать на отдельном сервере

### Долгосрочные (1-3 месяца)

6. **Production готовность**
   - Firewall правила
   - Security audit
   - Disaster recovery план
   - Документация для команды

7. **Migration на MainNet**
   - Запросить MainNet allocation
   - Получить whitelisting для MainNet
   - Развернуть production validator

---

## 📞 ЧАСТЬ 9: ПОДДЕРЖКА

### Если что-то пошло не так

1. **Проверьте логи:**
   ```bash
   docker logs canton-validator --tail=100
   ```

2. **Проверьте статус:**
   ```bash
   docker ps -a | grep canton
   ```

3. **Перезапустите валидатор:**
   ```bash
   docker restart canton-validator
   ```

4. **Если проблема критическая:**
   - Сохраните логи: `docker logs canton-validator > /tmp/canton-logs.txt`
   - Проверьте документацию: `blockchain/COMPLETE_CANTON_VALIDATOR_DEPLOYMENT_GUIDE.md`
   - Обратитесь к Canton Network support

### Полезные ресурсы

- **Canton Docs:** https://docs.canton.io
- **DevNet API:** https://sv.sv-1.dev.global.canton.network.sync.global
- **GitHub:** https://github.com/digital-asset/decentralized-canton-sync

---

## 🎓 ЗАКЛЮЧЕНИЕ

Вы успешно настроили и запустили Canton Validator! 🎉

**Ключевые моменты:**
- ✅ SSH без пароля настроен
- ✅ Валидатор работает на образе `canton-node-fixed:latest`
- ✅ Все команды управления задокументированы
- ✅ Мониторинг настроен
- ✅ Troubleshooting готов

**Помните:**
- DevNet onboarding secret действует 1 час
- Регулярно проверяйте логи на ошибки
- Делайте backup важных данных
- Обновляйте документацию при изменениях

---

**Версия:** 2.0 (Обновлено на основе реального развертывания)  
**Дата:** 28 ноября 2025  
**Образ:** canton-node-fixed:latest  
**Статус:** ✅ Рабочее развертывание