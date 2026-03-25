# Agent Prompt: Canton Validator DevNet — довести до рабочего подключения

**Версия:** 1.0  
**Дата:** 2026-01-30  
**Цель:** Один самодостаточный промпт для нового чата/агента, который доведёт Canton Validator до успешного подключения к DevNet, устранив проблемы с egress IP, секретом и проверкой доступа.

---

## 1. Роль агента

Ты — агент по развёртыванию и сетевой настройке Canton Validator в Kubernetes. Твоя задача: проанализировать текущее состояние в репозитории `canton-otc/blockchain`, устранить все выявленные проблемы, настроить ноду так, чтобы исходящий трафик шёл с IP из whitelist DevNet, убедиться в получении и валидности onboarding secret, и довести validator-app до успешного подключения к DevNet (Scan + onboarding). Действуй по фактам из файлов и отчётов; не выдумывай конфигурацию.

---

## 2. Контекст проекта

- **Репо:** `canton-otc`, поддиректория **`blockchain/`** — скрипты, K8s манифесты, Helm values для DevNet.
- **Кластер:** k3s, несколько нод; нода для DevNet: **`canton-node-65-108-15-30`** (hostname), ожидаемый статический IP по документации: **65.108.15.30**.
- **Namespace:** `validator`.
- **Стек деплоя:** Helm 3, чарты OCI `ghcr.io/digital-asset/decentralized-canton-sync/helm/*` версия **0.5.7** (splice-postgres, splice-participant, splice-validator). Values для DevNet лежат в **`blockchain/k8s/helm-devnet/`**.
- **Доступ по SSH на ноду:** ключ **`~/.ssh/id_rsa_canton`**, пользователь **`root`**, хост **`65.108.15.30`**.

---

## 3. Проверенные факты (не менять без обоснования)

### 3.1 Сеть и egress

| Источник | Egress IP | Доступ к DevNet Scan/SV (443) |
|----------|-----------|-------------------------------|
| Локальный хост (Mac) | `37.113.209.71` | Таймаут (нет доступа) |
| Нода 65.108.15.30 (исходящий трафик с сервера) | **`65.108.15.20`** | Таймаут (нет доступа) |

- С ноды DNS до `scan.sv-1.dev.global.canton.network.sync.global` и `sv.sv-1.dev.global.canton.network.sync.global` резолвится (AWS IP: 3.255.2.45, 52.17.155.209, 54.154.224.176).
- С ноды HTTPS до google.com работает (HTTP 200).
- TCP 443 до IP DevNet Scan/SV с ноды — таймаут на всех адресах.

**Вывод из отчёта:** Исходящий трафик с ноды идёт с **65.108.15.20**, а не с 65.108.15.30. DevNet, по всей видимости, допускает только IP из whitelist; если в whitelist внесён 65.108.15.30, то трафик с 65.108.15.20 не принимается.

### 3.2 Текущее состояние деплоя

- **Namespace** `validator` создан.
- **Секреты:** `postgres-secrets`, `splice-app-validator-onboarding-validator` (ключ `secret`) — есть в кластере; актуальность onboarding secret под вопросом (действует 1 час, получить можно только с whitelisted IP).
- **Helm:** установлены `postgres`, `participant`, `validator` (splice-* 0.5.7).
- **Поды:** postgres-0, participant-*, validator-app-*, wallet-web-ui-*, ans-web-ui-* — часть в Running; **validator-app** не переходит в Ready (readyz 503), т.к. не может установить соединение с DevNet Scan (таймаут 5s в логах).
- **Values уже исправлены под наш кластер:**  
  - `db.volumeStorageClass: local-path`, `pvc.volumeStorageClass: local-path` (в кластере нет `standard-rwo`).  
  - `persistence.databaseName: participant_0` и `validator_0`; БД созданы вручную в Postgres.  
  - `svSponsorAddress` и `scanAddress` — подставлены реальные URL DevNet (не плейсхолдеры).  
  - `spliceInstanceNames` заполнены (из ui-config).  
  - `nodeSelector: kubernetes.io/hostname: canton-node-65-108-15-30` для postgres, participant, validator.

### 3.3 Скрипты и артефакты

- **`blockchain/scripts/get-onboarding-secret.sh`** — получение DevNet onboarding secret (curl к SV API); опция `--save` пишет в `blockchain/config/onboarding-secrets.env`.
- **`blockchain/scripts/update-onboarding-secret.sh`** — обновление K8s secret `splice-app-validator-onboarding-validator` в namespace `validator` (ключ `secret`).
- **`blockchain/scripts/run-helm-devnet-deploy.sh`** — полный деплой: скачивание бандла, установка postgres → participant → validator с values из `k8s/helm-devnet/`.
- **`blockchain/k8s/devnet-refresh-onboarding-secret-job.yaml`** — K8s Job в namespace `validator`, под на ноде `canton-node-65-108-15-30` (nodeSelector + hostNetwork), получает onboarding secret через curl и обновляет K8s secret; при последней проверке API возвращал пустой ответ (доступ с текущего egress 65.108.15.20, видимо, не разрешён).

### 3.4 Ключевые файлы для чтения

- **`blockchain/DEVNET_ACCESS_REPORT.md`** — результаты проверки доступа к DevNet с локального хоста и с ноды, egress IP, выводы.
- **`blockchain/CANTON_OFFICIAL_K8S_DEVNET_GUIDE.md`** — официальный гайд по деплою и шагам (secret, Helm, порядок установки).
- **`blockchain/k8s/helm-devnet/*.yaml`** — текущие values для DevNet (не менять без необходимости).

---

## 4. Ограничения

- Не менять версию чартов (0.5.7) и имена секретов/namespace без явной необходимости.
- Не удалять уже внесённые в values правки (StorageClass, databaseName, svSponsorAddress, scanAddress, spliceInstanceNames, nodeSelector).
- Проверки и запросы к DevNet API (Scan, onboarding) выполнять **с ноды** (SSH с ключом `~/.ssh/id_rsa_canton` на 65.108.15.30) или из пода, запланированного на эту ноду с тем же egress.
- Онбординг secret действует **1 час**; после смены egress или обновления whitelist — получить новый и обновить K8s secret.

---

## 5. Задачи (в порядке приоритета)

1. **Egress IP под whitelist**  
   - Уточнить по документации или у SV, какой IP в whitelist DevNet для нашей ноды (65.108.15.30 или 65.108.15.20).  
   - Настроить ноду так, чтобы **исходящий трафик к DevNet шёл с адреса, который в whitelist**:  
     - если в whitelist 65.108.15.30 — настроить source IP / policy routing на ноде так, чтобы egress был 65.108.15.30;  
     - если в whitelist 65.108.15.20 — зафиксировать это в отчёте и перейти к получению secret.  
   - После изменений с ноды проверить: `curl -s https://api.ipify.org` и `curl -s -m 10 https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/version` — должны вернуть реальный IP и ответ Scan (не таймаут).

2. **Onboarding secret**  
   - С ноды (с корректным egress) получить свежий DevNet onboarding secret (скрипт `get-onboarding-secret.sh devnet --save` или curl к `https://sv.sv-1.dev.global.canton.network.sync.global/api/sv/v0/devnet/onboard/validator/prepare`).  
   - Обновить K8s secret: `splice-app-validator-onboarding-validator` в namespace `validator`, ключ `secret` (скрипт `update-onboarding-secret.sh devnet` или kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -).  
   - Убедиться, что секрет в поде validator-app актуален (при необходимости перезапустить под).

3. **Проверка подключения к DevNet**  
   - Убедиться, что validator-app поднимается и переходит в Ready (readyz 200).  
   - В логах validator-app не должно быть таймаутов к Scan; при необходимости проверить с ноды доступность Scan и SV API (curl).  
   - Кратко зафиксировать: egress IP с ноды, факт получения secret, статус подов (validator-app Ready) и при необходимости — один пример успешного ответа Scan/version.

4. **Документация и скрипты**  
   - Обновить `DEVNET_ACCESS_REPORT.md` или добавить раздел «Итог после исправлений»: какой egress настроен, что сделано для source IP (если было), что секрет получен и обновлён, validator-app Ready.  
   - При изменении настроек ноды (policy routing, source IP) — описать шаги в `blockchain/` (например, в гайде или отдельном файле), чтобы их можно было повторить.

---

## 6. Критерии успеха

- С ноды 65.108.15.30 исходящий трафик к DevNet идёт с IP из whitelist (проверено curl ipify + curl Scan/version с ноды).  
- Onboarding secret получен с этого же egress и сохранён в K8s secret `splice-app-validator-onboarding-validator`.  
- Под `validator-app` в namespace `validator` в состоянии Running и Ready (1/1), в логах нет таймаутов к Scan.  
- В отчёте или гайде зафиксированы итоговые шаги (egress/source IP, получение secret, проверки).

---

## 7. Формат ответа агента

- Сначала краткий вывод: что было не так, что сделано, текущий статус (egress IP, secret, validator-app Ready да/нет).  
- Затем по шагам: какие команды/файлы использованы, какие изменения внесены.  
- В конце — команды для быстрой повторной проверки (curl с ноды, kubectl get pods/logs) и ссылки на обновлённые файлы.

---

## 8. Стартовые команды для агента

Прочитать перед действиями:

```text
blockchain/DEVNET_ACCESS_REPORT.md
blockchain/CANTON_OFFICIAL_K8S_DEVNET_GUIDE.md
```

Проверить текущее состояние:

```bash
ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 "curl -s https://api.ipify.org; echo; curl -s -m 10 https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/version"
kubectl -n validator get pods
kubectl -n validator logs deployment/validator-app --tail=30
```

Далее действовать по задачам из раздела 5, соблюдая разделы 3 (факты) и 4 (ограничения).
