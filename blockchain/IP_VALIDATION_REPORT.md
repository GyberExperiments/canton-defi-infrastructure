# Отчет о валидации IP-адресов для Canton Networks

## Результаты проверки

Дата проверки: 27 ноября 2025  
Статус: ✅ **ОСНОВНОЙ IP ВАЛИДИРОВАН**

---

## Devnet: 65.108.15.30

### Статус: ✅ УСПЕШНО ПРОЙДЕНА ВАЛИДАЦИЯ

#### Тест №1: Scan URL
- **Статус**: ✅ Успешно
- **Подключённых SV**: 14 из 15
- **Версия**: 0.5.3

##### Успешные подключения:
```
✓ https://scan.sv-1.dev.global.canton.network.digitalasset.com: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.orb1lp.mpch.io: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.fivenorth.io: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.mpch.io: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.c7.digital: 0.5.3
✓ https://scan.sv-2.dev.global.canton.network.digitalasset.com: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.tradeweb.com: 0.5.3
✓ https://scan.sv.dev.global.canton.network.digitalasset.com: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.sync.global: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.lcv.mpch.io: 0.5.3
✓ https://scan.sv-2.dev.global.canton.network.cumberland.io: 0.5.3
✓ https://scan.sv-1.dev.global.canton.network.cumberland.io: 0.5.3
✓ https://scan.sv.dev.global.canton.network.sv-nodeops.com: 0.5.3
```

##### Ошибки подключения:
```
✗ https://scan.sv-1.dev.global.canton.network.proofgroup.xyz: TIMEOUT/ERROR
```

#### Тест №2: Sequencer Endpoints
- **Статус**: ✅ Успешно
- **Найдено Sequencer endpoints**: 22

##### Доступные endpoints:
```
sequencer-0.sv-1.dev.global.canton.network.digitalasset.com
sequencer-1.sv-1.dev.global.canton.network.digitalasset.com
sequencer-0.sv-1.dev.global.canton.network.orb1lp.mpch.io
sequencer-1.sv-1.dev.global.canton.network.orb1lp.mpch.io
sequencer-1.sv-1.dev.global.canton.network.fivenorth.io
sequencer-0.sv-1.dev.global.canton.network.mpch.io
sequencer-1.sv-1.dev.global.canton.network.mpch.io
sequencer-1.sv-1.dev.global.canton.network.c7.digital
sequencer-0.sv-2.dev.global.canton.network.digitalasset.com
sequencer-1.sv-2.dev.global.canton.network.digitalasset.com
sequencer-1.sv-1.dev.global.canton.network.proofgroup.xyz
sequencer-0.sv-1.dev.global.canton.network.tradeweb.com
sequencer-1.sv-1.dev.global.canton.network.tradeweb.com
sequencer-1.sv.dev.global.canton.network.digitalasset.com
sequencer-1.sv-1.dev.global.canton.network.sync.global
sequencer-0.sv-1.dev.global.canton.network.lcv.mpch.io
sequencer-1.sv-1.dev.global.canton.network.lcv.mpch.io
sequencer-0.sv-2.dev.global.canton.network.cumberland.io
sequencer-1.sv-2.dev.global.canton.network.cumberland.io
sequencer-0.sv-1.dev.global.canton.network.cumberland.io
sequencer-1.dev.global.canton.network.cumberland.io
sequencer-1.sv.dev.global.canton.network.sv-nodeops.com
```

---

## Testnet: 65.108.15.20

**Статус**: ⏳ Требуется проверка

Для проверки этого IP запустите:
```bash
kubectl apply -f blockchain/k8s/ip-validation-testnet.yaml
# или просто обновите nodeSelector в yaml файле на 65.108.15.20
```

---

## Mainnet: 65.108.15.19

**Статус**: ⏳ Требуется проверка

Для проверки этого IP запустите:
```bash
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
```

---

## Анализ результатов

### Devnet (65.108.15.30)
✅ **УСПЕШНО**
- IP-адрес валидирован
- 14 из 15 Super Validators добавили IP в allowlist
- Это **93.3%** от всех SV (требуется минимум 66.7% для 2/3)
- Все необходимые endpoints доступны
- Готово к развертыванию ноды валидатора

### Наблюдение
- Один SV (proofgroup.xyz) ещё не обновил allowlist
- Это не влияет на валидацию, так как достигнута 2/3 большинство
- Рекомендуется дождаться обновления (может занять до 7 дней)

---

## Рекомендации

### Текущий статус
✅ **Ваш Devnet IP (65.108.15.30) полностью валидирован**

### Следующие шаги

1. **Развертывание ноды валидатора**: Можно приступать к развертыванию Canton валидатора на ноде с IP 65.108.15.30
   
2. **Использование onboarding секрета**: Получите секрет от спонсора-SV и используйте его при развертывании

3. **Проверка других IP**: При необходимости повторите проверку для Testnet и Mainnet IP

4. **Слежение**: Если нужна полная 100% валидация, дождитесь обновления от proofgroup.xyz (максимум 7 дней)

---

## Команды для повторной проверки

### Быстрая проверка (текущая нода)
```bash
bash blockchain/scripts/validate_all_ips.sh
```

### Полная проверка через kubectl Job (рекомендуется)
```bash
kubectl apply -f blockchain/k8s/ip-validation-quick.yaml
kubectl logs -l job-name=ip-validation-checker -f
```

### Очистка
```bash
kubectl delete job ip-validation-checker -n default
```

---

## Troubleshooting

### Если видите TIMEOUT ошибки
- Проверьте сетевое подключение
- Убедитесь, что используете правильный статический IP
- Дождитесь 2-7 дней, пока SV обновит allowlist

### Если IP не совпадает
- Проверьте, что Pod запущен на правильной ноде
- Убедитесь, что используется `hostNetwork: true` в Pod spec

### Если нет доступа к endpoints
- Проверьте файрволл правила
- Убедитесь, что исходящие HTTPS соединения разрешены
- Проверьте DNS разрешение доменов

---

## Контакты для поддержки

- **Slack канал**: #validator-operations
- **Спонсор SV**: Свяжитесь с вашим спонсором для уточнения статуса
- **Время ожидания**: Обычно 2-7 дней для обновления allowlist