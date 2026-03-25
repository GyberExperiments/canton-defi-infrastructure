# Как запустить проверку валидации IP-адресов

## ⚡ Быстрый старт

### Вариант 1: Запустить через kubectl Job (рекомендуется)

```bash
# Для Devnet (65.108.15.30) - уже выполнено
kubectl apply -f blockchain/k8s/ip-validation-quick.yaml

# Смотреть результаты в реальном времени
kubectl logs -l job-name=ip-validation-checker -f

# Просмотреть отчет
kubectl logs -l job-name=ip-validation-checker --tail=200
```

### Вариант 2: Локально со своей машины

```bash
bash blockchain/scripts/validate_all_ips.sh
```

⚠️ **Внимание**: Это даст ошибку, так как ваша машина не имеет статического IP 65.108.15.30

---

## 📊 Текущий статус

### ✅ Devnet (65.108.15.30) - ВАЛИДИРОВАН

**Результаты от 27 ноября 2025**

#### Тест №1: Scan URL
- ✅ Успешно подключено к 14 из 15 Super Validators
- Версия: 0.5.3
- Успешность: **93.3%** (требуется минимум 66.7%)

#### Тест №2: Sequencer Endpoints
- ✅ Найдено 22 доступных Sequencer endpoints
- Все endpoints доступны и отвечают

**Статус**: 🟢 **ГОТОВО К РАЗВЕРТЫВАНИЮ**

---

## 🔄 Проверка других IP

### Testnet (65.108.15.20)

```bash
# Отредактируйте blockchain/k8s/ip-validation-quick.yaml
# Измените nodeSelector на нужный IP или нужную ноду

# Запустите проверку
kubectl apply -f blockchain/k8s/ip-validation-quick.yaml
```

### Mainnet (65.108.15.19)

```bash
# Аналогично Testnet - отредактируйте nodeSelector
kubectl apply -f blockchain/k8s/ip-validation-quick.yaml
```

---

## 📁 Структура файлов

```
blockchain/
├── k8s/
│   ├── ip-validation-quick.yaml          ← 🟢 ОСНОВНОЙ (работает!)
│   ├── ip-validation-job-ubuntu.yaml     ← Альтернативный (требует grpcurl)
│   ├── ip-validation-job.yaml            ← Старый (Alpine - нет интернета)
│
├── scripts/
│   ├── scan_test.sh                      ← Отдельный тест Scan URL
│   ├── sequencer_test.sh                 ← Отдельный тест Sequencer
│   ├── validate_all_ips.sh               ← Комплексный локальный тест
│   ├── run_validation_on_node.sh         ← Запуск через kubectl debug
│
├── IP_VALIDATION_REPORT.md               ← Подробный отчет результатов
└── RUN_IP_VALIDATION.md                  ← Этот файл
```

---

## 🛠️ Полезные команды

### Просмотр текущего Job'а
```bash
kubectl get jobs -n default | grep validation
```

### Просмотр Pod'а
```bash
kubectl get pods -n default -o wide | grep validation
```

### Описание Pod'а (для отладки)
```bash
kubectl describe pod -l job-name=ip-validation-checker -n default
```

### Удаление Job'а
```bash
kubectl delete job ip-validation-checker -n default
```

### Проверка логов узла
```bash
kubectl logs -l job-name=ip-validation-checker -n default --all-containers=true
```

---

## 🔍 Интерпретация результатов

### Успешная проверка выглядит так:

```
✓ https://scan.sv-X.dev.global.canton.network.DOMAIN: 0.5.3
```

### Ошибка подключения выглядит так:

```
✗ https://scan.sv-X.dev.global.canton.network.DOMAIN: TIMEOUT/ERROR
```

### Требования к валидации:
- Минимум ✅ **2/3 Super Validators** должны добавить IP в allowlist
- Текущий статус: 14/15 = **93.3%** ✅ **ПЕРЕВЫПОЛНЕНО**

---

## 📝 Что делать дальше?

### 1. Если тест прошел успешно (как в вашем случае)
```
✅ IP-адрес валидирован
✅ Готово к развертыванию ноды валидатора
✅ Получите секрет от спонсора-SV
✅ Запустите развертывание Canton узла
```

### 2. Если видите ошибки TIMEOUT
```
⏳ Это нормально - некоторые SV еще не обновили allowlist
⏳ Ожидание: 2-7 дней
⏳ Повторите проверку позже

Требование: минимум 2/3 SV должны добавить IP
Если прошло более 7 дней - свяжитесь со спонсором
```

### 3. После валидации
```bash
# Получите onboarding secret от спонсора-SV
bash blockchain/scripts/get-onboarding-secret.sh

# Развертните Canton валидатор
bash blockchain/scripts/deploy-canton-validator.sh
```

---

## 🚀 Быстрая ссылка на развертывание

После успешной валидации IP, используйте:

```bash
# Подготовка сервера
bash blockchain/scripts/setup-server-65-108-15-30.sh

# Установка Canton узла
bash blockchain/scripts/deploy-canton-validator.sh

# Мониторинг статуса
bash blockchain/scripts/monitor-canton-node.sh

# Проверка валидатора
bash blockchain/scripts/check-validator-status.sh
```

---

## ❓ FAQ

### Q: Почему один SV еще не в whitelist?
A: Это нормально. Обновление может занять 2-7 дней. Требуется минимум 2/3, вы уже достигли 14/15.

### Q: Нужно ли ждать пока все 15 SV добавят IP?
A: Нет, требуется минимум 2/3 (10 из 15). Вы уже прошли валидацию.

### Q: Как узнать текущий IP ноды?
A: Скрипт проверяет автоматически через `curl checkip.amazonaws.com`

### Q: Что если видю "TIMEOUT"?
A: SV еще не добавил ваш IP в allowlist. Дождитесь обновления (2-7 дней).

### Q: Могу ли я развертывать ноду сейчас?
A: Да! ✅ Ваш IP полностью валидирован (93.3% от SV). Готово к развертыванию.

---

## 📞 Контакты и поддержка

- **Slack**: #validator-operations
- **Спонсор SV**: Свяжитесь для уточнения статуса proofgroup.xyz
- **Время ответа**: Обычно 2-7 дней для обновления allowlist

---

Последнее обновление: 27 ноября 2025
Версия: 1.0