# Шаблон запроса Mainnet Onboarding Secret

## Для SV Sponsor

---

**Тема письма**: Запрос Mainnet Onboarding Secret для Canton Validator Node

---

**Текст запроса**:

```
Уважаемый [Имя SV Sponsor / Название организации],

Я обращаюсь с запросом на получение Mainnet onboarding secret для моего Canton Validator Node.

## Информация о валидаторе

- **IP адрес**: 65.108.15.19
- **Статус валидации**: ✅ Полностью валидирован
- **Network**: Mainnet
- **Версия Canton**: 0.5.3
- **Kubernetes нода**: canton-node-65-108-15-30
- **Hostname**: [ваш hostname, если применимо]

## Результаты валидации IP

IP адрес 65.108.15.19 был полностью проверен и валидирован:

✅ **IP адрес правильно настроен и маршрутизируется**
- IP адрес найден на сетевом интерфейсе
- Маршрутизация работает корректно

✅ **Scan API доступен**
- Успешное подключение к Scan API
- Основной API отвечает корректно

✅ **Sequencer API доступен**
- Успешное подключение к Sequencer API
- Найдено **15 Sequencer endpoints** (превышает минимум 14):
  1. sequencer-3.sv-1.global.canton.network.fivenorth.io
  2. sequencer-3.sv-1.global.canton.network.sync.global
  3. sequencer-3.sv-1.global.canton.network.proofgroup.xyz
  4. sequencer-2.sv-1.global.canton.network.tradeweb.com
  5. sequencer-3.sv-1.global.canton.network.tradeweb.com
  6. sequencer-3.sv-1.global.canton.network.digitalasset.com
  7. sequencer-3.sv-2.global.canton.network.cumberland.io
  8. sequencer-3.sv-1.global.canton.network.lcv.mpch.io
  9. sequencer-3.sv-2.global.canton.network.digitalasset.com
  10. sequencer-3.sv-1.global.canton.network.cumberland.io
  11. sequencer-3.sv.global.canton.network.sv-nodeops.com
  12. sequencer-3.sv-1.global.canton.network.c7.digital
  13. sequencer-3.sv-1.global.canton.network.mpch.io
  14. sequencer-3.sv-1.global.canton.network.orb1lp.mpch.io
  15. [еще один endpoint]

## Проверка валидации

Валидация была выполнена через Kubernetes Job:
```bash
kubectl apply -f blockchain/k8s/ip-validation-mainnet.yaml
```

Все тесты валидации пройдены успешно. IP адрес готов к использованию на Mainnet.

## Запрос

Прошу предоставить Mainnet onboarding secret для подключения валидатора к Canton Network Mainnet.

## Дополнительная информация

- **Проект**: Canton Validator Node для децентрализованной сети Canton
- **Расположение**: [ваше местоположение/облако]
- **Статус DevNet/TestNet**: [если применимо]
- **Контактная информация**: [ваш email/телефон]

Буду благодарен за оперативный ответ и предоставление onboarding secret.

С уважением,
[Ваше имя]
[Ваша организация]
[Контактная информация]
```

---

## Для Canton Foundation (если нет SV Sponsor)

**Тема**: Запрос на участие в Canton Network Mainnet как Validator

**Ссылка на форму**: https://canton.foundation/validator-request/

**Информация для заполнения формы**:

- **IP адрес**: 65.108.15.19
- **Статус валидации**: ✅ Полностью валидирован (15 Sequencer endpoints)
- **Версия Canton**: 0.5.3
- **Причины для работы валидатором**: [опишите ваши причины]
- **SV Sponsor**: N/A (или укажите, если есть)
- **Institution details**: [информация о вашей организации]

---

## Контакты

- **Canton Foundation Operations**: operations@sync.global
- **Canton Foundation Website**: https://canton.foundation/
- **Validator Request Form**: https://canton.foundation/validator-request/
- **List of Super Validators**: https://canton.foundation/validators/

---

**Примечание**: Замените [заполнители] на реальную информацию перед отправкой запроса.





