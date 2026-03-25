# Отчёт: доступ к DevNet Canton

**Дата проверки:** 2026-01-30

---

## 1. Локальный хост (Mac)

| Проверка | Результат |
|----------|-----------|
| **Egress IP** | `37.113.209.71` |
| **DNS** (Scan) | Резолвится: 3.255.2.45, 54.154.224.176, 52.17.155.209 |
| **DevNet Scan API** (`/api/scan/version`) | **Таймаут 15 с** (HTTP 000) |
| **DevNet SV API** (onboarding POST) | **Таймаут 15 с** (HTTP 000) |

**Вывод:** С локальной машины до DevNet Scan и SV доступа нет (таймаут).

---

## 2. Нода 65.108.15.30 (SSH, ключ `~/.ssh/id_rsa_canton`)

| Проверка | Результат |
|----------|-----------|
| **Egress IP** | **`65.108.15.20`** — исходящий трафик идёт с **другого** IP, не с 65.108.15.30 |
| **DNS** (Scan, SV) | Резолвится: 52.17.155.209, 54.154.224.176, 3.255.2.45 |
| **HTTPS до google.com** | **HTTP 200** — общий исходящий HTTPS работает |
| **TCP 443 до Scan** | **Таймаут** на всех трёх IP (3.255.2.45, 52.17.155.209, 54.154.224.176) |
| **curl -v к Scan** | `Trying 3.255.2.45:443` → timeout; `52.17.155.209:443` → timeout; `54.154.224.176:443` → timeout |

**Вывод:** С ноды общий интернет (google) доступен, до DevNet Scan/SV — только таймаут (TCP не устанавливается).

---

## 3. Причина

- **DNS в порядке** и у тебя, и на ноде.
- **Исходящий HTTPS с ноды работает** (google отвечает).
- **До IP DevNet (AWS: 3.255.2.45, 52.17.155.209, 54.154.224.176) TCP 443 не устанавливается** — таймаут на соединении.

Типичное объяснение: **на стороне DevNet (или AWS перед Scan/SV) стоит ограничение по IP (allowlist)**. Подключения с твоих IP не принимаются (пакеты отбрасываются или не маршрутизируются), поэтому видишь таймаут, а не 403/connection refused.

Важно: **реальный egress с ноды — 65.108.15.20**, а не 65.108.15.30. Если в allowlist DevNet внесён только 65.108.15.30, то трафик с 65.108.15.20 не будет допускаться.

---

## 4. Рекомендации

1. **Уточнить у SV/DevNet:** какие IP в allowlist для DevNet (Scan + onboarding). Убедиться, что там указан **65.108.15.20** (фактический egress ноды), а не только 65.108.15.30.
2. **Либо настроить ноду так, чтобы исходящий трафик шёл именно с 65.108.15.30** (если этот IP в allowlist): привязка исходящего к нужному адресу (policy routing / source IP), чтобы egress был 65.108.15.30.
3. **Локальный хост (37.113.209.71):** для доступа к DevNet с Mac этот IP тоже должен быть в allowlist, если планируется обращаться к Scan/SV с локальной машины.

---

## 5. Краткий вердикт

| Вопрос | Ответ |
|--------|--------|
| У нас ошибка в конфиге/коде? | **Нет** — конфиг и деплой в порядке. |
| Есть ли доступ к DevNet с нашего IP? | **Нет** — TCP до Scan/SV таймаутится и с ноды, и с локального хоста. |
| Скорее всего причина | **Ограничение доступа по IP на стороне DevNet (allowlist)** и/или несовпадение egress ноды (65.108.15.20) с ожидаемым IP (65.108.15.30). |

---

## 6. Итог после исправлений (2026-01-30)

### Что сделано

1. **Egress к DevNet = 65.108.15.30**  
   В allowlist DevNet (Scan + SV) указан **65.108.15.30**. Фактический egress с ноды был 65.108.15.20 (маршрут `65.108.15.0/24` с `src 65.108.15.20`). На ноде настроены:
   - **Policy routing:** таблица 100 с `default via 65.108.15.1 dev enp8s0 src 65.108.15.30`; правила `ip rule add to <IP> lookup 100` для DevNet IP: 3.255.2.45, 54.154.224.176, 52.17.155.209. Трафик с хоста к этим IP идёт с source 65.108.15.30.
   - **SNAT для подов:** в `iptables -t nat` добавлены правила `-d <IP> -j SNAT --to-source 65.108.15.30` для тех же трёх IP (в начале POSTROUTING), чтобы трафик из подов K8s к DevNet тоже выходил с 65.108.15.30.

2. **Проверка с ноды после настроек**  
   - `curl -s https://api.ipify.org` → по умолчанию по-прежнему 65.108.15.20.  
   - `curl -s -m 10 https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/version` → **200 OK**, `{"version":"0.5.9",...}`.  
   - `curl -s -X POST https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare` → **200**, в ответе base64-токен с полем `secret`.

3. **Onboarding secret**  
   С ноды (с корректным egress) получен свежий DevNet onboarding secret (POST к SV API). Значение (полный base64-ответ) записано в K8s secret `splice-app-validator-onboarding-validator` в namespace `validator` (ключ `secret`). Под `validator-app` перезапущен для подхвата secret.

4. **validator-app**  
   - Под подключается к **seed Scan** (sync.global): в логах «Found app version», «HTTP … /api/scan/v0/amulet-rules … 200 OK», «HTTP … /api/scan/v0/scans … 200 OK». Таймаутов к Scan sync.global больше нет.  
   - **Ready 1/1 не достигнут:** в логах «Only 1 scan instances can be used (out of 14 configured ones), which are fewer than the necessary **5** to achieve BFT guarantees». Остальные Scan (Five-North-1, Digital-Asset-1, Cumberland-1, …) отдают 403 или таймаут — у них свой allowlist; наш IP 65.108.15.30 туда, по всей видимости, не внесён. Протокол требует минимум 5 работающих Scan для BFT, поэтому readyz остаётся 503.

### Итоговая таблица

| Параметр | Значение |
|----------|----------|
| **Egress к DevNet (с ноды и из подов)** | 65.108.15.30 (policy routing + SNAT) |
| **Доступ к Scan sync.global** | Есть (версия, amulet-rules, список сканов) |
| **Доступ к SV API (onboarding)** | Есть, secret получен |
| **K8s secret onboarding** | Обновлён, ключ `secret` |
| **validator-app Ready** | 0/1 — не хватает 5 Scan для BFT (работает только sync.global) |

### Шаги по source IP / policy routing и SNAT (на ноде 65.108.15.30)

Выполнять от root на ноде (или по SSH: `ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30`). После перезагрузки правила и маршруты сбрасываются — скрипт нужно запускать снова (или добавить в systemd/network).

**Вариант 1 — одна команда (вставить в скрипт или выполнить вручную):**

```bash
# Таблица 100: default с source 65.108.15.30
ip route add default via 65.108.15.1 dev enp8s0 src 65.108.15.30 table 100 2>/dev/null || true
for ip in 3.255.2.45 54.154.224.176 52.17.155.209; do
  ip rule add to $ip lookup 100 2>/dev/null || true
done
# SNAT для подов к DevNet
for ip in 3.255.2.45 54.154.224.176 52.17.155.209; do
  iptables -t nat -C POSTROUTING -d $ip -j SNAT --to-source 65.108.15.30 2>/dev/null || iptables -t nat -I POSTROUTING 1 -d $ip -j SNAT --to-source 65.108.15.30
done
```

**Вариант 2 — скрипт в репо:** `blockchain/scripts/setup-devnet-egress-on-node.sh` (запускать на ноде; см. скрипт для полного набора команд и проверок).

Интерфейс и шлюз в примере — `enp8s0` и `65.108.15.1`; на другой ноде могут отличаться.
