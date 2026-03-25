# DAML Smart Contracts — Аудит и план продакшен-реализации

**Дата:** 2025-02-04  
**Scope:** все модули `daml/src/`  
**Спека:** 05_DAML_CONTRACTS_SPEC

---

## Scope

- **Modules:** `Common/Types.daml`, `Common/Compliance.daml`, `Treasury/TreasuryBillToken.daml`, `Treasury/TreasuryBillHolding.daml`, `Treasury/YieldDistribution.daml`
- **Dependencies:** Token → Holding, YieldDistribution; Holding → YieldDistribution; Compliance/Types — общие
- **Spec refs:** §2.1 Types, §2.2 Compliance, §3.1 Token, §3.2 Holding, §3.3 Yield

---

## 1. Authorization & Signatories

| Template | Signatories | Observers | Замечания |
|----------|-------------|-----------|-----------|
| TreasuryBillToken | issuer, custodian | regulator | OK |
| TreasuryBillHolding | custodian | holder | Создание Holding требует подписи custodian |
| YieldPayment | recipient | — | Создание требует подписи recipient |
| RedemptionReceipt | redeemer | — | Создание требует подписи redeemer |
| RedemptionRequest | requester | — | OK при создании holder'ом |

**Issues:**

- **TreasuryBillToken.daml:44–79 (PurchaseTokens):** Controller = buyer. Создаётся `TreasuryBillHolding` с signatory = custodian. В DAML создание контракта требует авторизации всех signatories. Buyer не может единолично подписать создание контракта с signatory custodian → транзакция будет отклонена, если submission только от buyer. **Рекомендация:** либо явно требовать мульти-парти submission (buyer + custodian), либо сменить дизайн: Holding signatory = holder, observer = custodian (тогда buyer создаёт свою позицию сам).
- **TreasuryBillToken.daml:80–88 (UpdatePrice):** Controller = custodian. Пересоздаётся `TreasuryBillToken` с signatory issuer, custodian. Issuer должен подписать → мульти-парти (issuer + custodian) или расширить controller.
- **TreasuryBillToken.daml:89–106 (DistributeYield):** Controller = custodian. Создаётся `YieldPayment` с signatory = recipient. Custodian не может единолично создать контракт с signatory recipient. **Рекомендация:** Propose-Accept: custodian создаёт оффер (signatory custodian, observer recipient), recipient выполняет Accept → создаёт YieldPayment.
- **TreasuryBillToken.daml:107–125 (RedeemAtMaturity):** Controller = custodian. Создаётся `RedemptionReceipt` с signatory = redeemer (holder). Аналогично — нужна подпись holder. **Рекомендация:** Propose-Accept для погашения.
- **TreasuryBillHolding.daml:24–46 (TransferHolding):** Controller = holder. Создаётся новый `TreasuryBillHolding` с signatory = custodian. Holder не может подписать за custodian. **Рекомендация:** мульти-парти (holder + custodian) или оффер от holder, акцепт от custodian.
- **TreasuryBillHolding.daml:49–74 (PartialRedeem):** При частичном погашении создаётся новый `TreasuryBillHolding` с signatory custodian → нужна подпись custodian.

---

## 2. Invariants & ensure

- **TreasuryBillToken:** ensure покрывает faceValue, totalSupply, outstandingSupply, price, даты. Инвариант `outstandingSupply <= totalSupply` есть, но **outstandingSupply нигде не уменьшается при покупке** → инвариант не отражает реальное состояние после покупок (supply не консервируется on-ledger).
- **TreasuryBillHolding:** ensure amount > 0 — OK.
- **YieldPayment / RedemptionReceipt / RedemptionRequest:** ensure отсутствуют (amount > 0, status и т.д. — желательно).

**Issues:**

- **TreasuryBillToken:** Нет уменьшения `outstandingSupply` при PurchaseTokens. Либо явный дизайн "supply учёт off-ledger", либо consuming выбор, пересоздающий Token с уменьшенным supply (и тогда PurchaseTokens должен быть consuming по токену и пересоздавать токен с новой supply). **Рекомендация:** ввести уменьшение supply on-ledger: PurchaseTokens делаем consuming по Token, пересоздаём Token с outstandingSupply - tokenAmount и создаём Holding.
- **YieldDistribution:** Добавить ensure amount > 0 для YieldPayment, RedemptionReceipt, RedemptionRequest.

---

## 3. Consuming / Nonconsuming

- **UpdatePrice:** consuming, пересоздаёт Token — верно.
- **PurchaseTokens:** nonconsuming, не архивирует Token — верно (но см. supply выше).
- **DistributeYield:** nonconsuming, не архивирует Token — верно.
- **RedeemAtMaturity:** nonconsuming по Token, но архивирует Holding через `archive holdingCid`. По правилу "nonconsuming не архивирует этот контракт" — контракт выбора (Token) не архивируется, поэтому формально допустимо. Архивация Holding авторизована custodian (signatory Holding).
- **TransferHolding / PartialRedeem:** consuming по Holding — верно.

**Issues:** Нет критических нарушений consuming/nonconsuming. После введения уменьшения supply в PurchaseTokens выбор станет consuming по Token.

---

## 4. Data Consistency & Arithmetic

- **PurchaseTokens:** tokenAmount = purchaseAmount / pricePerToken. pricePerToken > 0 по ensure — деления на ноль нет.
- **DistributeYield:** yieldAmount = (holding.amount / outstandingSupply) * totalYield. **outstandingSupply может быть 0** (ensure только outstandingSupply <= totalSupply, не outstandingSupply > 0). После полных погашений supply может стать 0 → деление на ноль. **Рекомендация:** assertMsg "No outstanding supply for distribution" $ outstandingSupply > 0.0.
- **Compliance:** В PurchaseTokens не проверяется `compliance.expirationDate >= toDateUTC now` → просроченный KYC может быть использован. **Рекомендация:** assertMsg "Compliance record expired" $ compliance.expirationDate >= toDateUTC now (или передать now и сравнить).
- **TransferHolding:** Не проверяется, что newCompliance удовлетворяет requiredComplianceLevel и allowedJurisdictions токена. Holding не хранит ссылку на токен (только tokenId), поэтому проверку нужно делать либо на границе (клиент передаёт валидный compliance), либо ввести зависимость Holding от токена (fetch по tokenId) и проверять. **Рекомендация:** при transfer проверять compliance нового держателя против правил эмиссии (требует доступа к параметрам токена — через выбор на Token или передачу параметров в выбор).

---

## 5. Contention & Performance

- Один контракт на эмиссию (Token), отдельные контракты на позиции (Holding) — партиционирование хорошее.
- **DistributeYield:** принимает список `holdingCids` неограниченной длины; sequence (map fetch/create) — при большом N возможны лимиты и рост времени. **Рекомендация:** ограничить размер батча (например max 100) и assert в начале выбора.
- **Contract keys:** Нет ключей. Поиск токена по tokenId и holding по (tokenId, holder) — через query. Для продакшена желательно key на TreasuryBillToken (tokenId) и TreasuryBillHolding (tokenId, holder) с соответствующими maintainers.

---

## 6. Security & Compliance

- checkCompliance/checkJurisdiction вызываются на границе (PurchaseTokens) — OK.
- **expirationDate** compliance не проверяется — см. п. 4.
- **Transfer:** повторная проверка compliance для newHolder не выполняется в контракте — см. п. 4.
- Regulator: Optional Party — в коде не предполагается обязательное наличие, OK.
- Валидация входов: в целом есть (assertMsg по amount, supply, compliance).

---

## 7. Idempotency & Double-Spend

- **DistributeYield:** повторный вызов с теми же holdingCids создаёт второй набор YieldPayment для той же даты/суммы → двойная выплата. **Рекомендация:** ввести контракт DistributionRun (tokenId, distributionDate, totalYield) с key; DistributeYield создаёт/использует один такой run и создаёт выплаты только если run в статусе Created один раз; либо idempotency key на (tokenId, distributionDate) и проверка "ещё не распределяли".
- **RedeemAtMaturity:** повторный вызов по тому же holdingCid приведёт к ошибке (holding уже архивирован) — OK.
- **PartialRedeem:** несколько запросов на погашение от одного holding возможны; обработка off-ledger кастодианом может привести к двойной выплате при неаккуратной логике. On-ledger при полном погашении holding архивируется — OK.

---

## 8. Recommendations (сводная таблица)

| Severity | Location | Issue | Recommendation |
|----------|----------|--------|-----------------|
| Critical | TreasuryBillToken.daml:44–79 | PurchaseTokens создаёт Holding (signatory custodian), controller buyer — нет авторизации custodian | Мульти-парти submission (buyer+custodian) или сменить Holding: signatory holder, observer custodian |
| Critical | TreasuryBillToken.daml:89–106 | DistributeYield создаёт YieldPayment (signatory recipient), controller custodian | Propose-Accept: YieldDistributionOffer (custodian) → AcceptOffer (recipient) создаёт YieldPayment |
| Critical | TreasuryBillToken.daml:107–125 | RedeemAtMaturity создаёт RedemptionReceipt (signatory redeemer), controller custodian | Propose-Accept: RedemptionOffer (custodian) → AcceptRedemption (redeemer) создаёт RedemptionReceipt |
| Critical | TreasuryBillToken (ensure + PurchaseTokens) | outstandingSupply не уменьшается при покупке — нарушение консервации supply | PurchaseTokens сделать consuming по Token; пересоздавать Token с outstandingSupply - tokenAmount; создавать Holding |
| High | TreasuryBillHolding.daml:24–46 | TransferHolding создаёт новый Holding (signatory custodian), controller holder | Мульти-парти (holder+custodian) или Propose-Accept (holder предлагает, custodian акцептирует) |
| High | TreasuryBillHolding.daml:49–74 | PartialRedeem создаёт новый Holding (signatory custodian), controller holder | Мульти-парти при частичном погашении или Propose-Accept |
| High | TreasuryBillToken.daml:52–57 | Не проверяется compliance.expirationDate | assertMsg "Compliance expired" $ compliance.expirationDate >= toDateUTC now (передать now в choice или getTime) |
| High | TreasuryBillToken.daml:89–99 | Деление на outstandingSupply при 0 | assertMsg "No outstanding supply" $ outstandingSupply > 0.0 в DistributeYield |
| High | TreasuryBillHolding TransferHolding | Нет проверки newCompliance против правил токена | Добавить проверку checkCompliance(newCompliance, level) и checkJurisdiction для токена (параметры передать в choice или хранить в Holding) |
| Medium | TreasuryBillToken.daml:80–88 | UpdatePrice создаёт Token (signatory issuer, custodian), controller custodian | Мульти-парти (issuer + custodian) или controller (issuer, custodian) |
| Medium | DistributeYield | Неограниченный список holdingCids | Ограничить размер списка (например max 100), assertMsg в начале выбора |
| Medium | DistributeYield | Двойная выплата при повторном вызове | Ввести DistributionRun или idempotency по (tokenId, distributionDate) |
| Medium | Все шаблоны | Нет contract key | Добавить key для TreasuryBillToken (tokenId), TreasuryBillHolding (tokenId, holder) |
| Low | YieldDistribution | Нет ensure amount > 0 | Добавить ensure для YieldPayment, RedemptionReceipt, RedemptionRequest |
| Info | RedemptionReceipt | Нет choice ClaimRedemption | Добавить consuming choice ClaimRedemption (controller redeemer) для перехода в CONFIRMED по аналогии с YieldPayment |

---

## План полнофункциональной реализации для прода и DevNet

1. **Авторизация (production-ready):**
   - **Вариант A (минимальные изменения):** Документировать мульти-парти submission для PurchaseTokens, UpdatePrice, TransferHolding, PartialRedeem, DistributeYield, RedeemAtMaturity — все вызовы от имени buyer/holder должны включать подпись custodian; для выплат — подпись recipient/redeemer.
   - **Вариант B (рекомендуемый):** Propose-Accept для всех кейсов, где одна сторона создаёт контракт с signatory другой:
     - Yield: YieldDistributionOffer → AcceptYieldOffer.
     - Redemption: RedemptionOffer → AcceptRedemptionOffer.
     - Transfer: TransferOffer (holder) → AcceptTransfer (custodian).
     - Partial redeem: оставить создание RedemptionRequest за holder; для уменьшения Holding — RedeemOffer (holder) → AcceptRedeem (custodian) с пересозданием Holding.
   - Holding: оставить signatory custodian для соответствия модели "кастодиан владеет записью", но все создания Holding инициировать через офферы с акцептом custodian (или мульти-парти).

2. **Supply on-ledger:** PurchaseTokens — consuming по Token; пересоздать Token с outstandingSupply - tokenAmount; создать Holding. Добавить ensure outstandingSupply >= 0.0 (после покупок может быть 0 к погашению).

3. **Compliance:** Проверка expirationDate в PurchaseTokens (getTime, toDateUTC); в TransferHolding — передать в выбор requiredComplianceLevel и allowedJurisdictions (или ContractId Token для fetch) и проверять newCompliance.

4. **Contract keys:** TreasuryBillToken key (tokenId) maintainer (issuer, custodian); TreasuryBillHolding key (tokenId, holder) maintainer custodian.

5. **DistributeYield:** Ограничение размера списка (например 100); assert outstandingSupply > 0; ввести DistributionRun с key (tokenId, distributionDate) — один раз создаётся run, выплаты привязаны к run (или проверка "ещё не распределяли по этой дате").

6. **Ensure и границы:** ensure amount > 0 в YieldPayment, RedemptionReceipt, RedemptionRequest; проверки знаменателей; RedemptionReceipt — choice ClaimRedemption.

7. **Обратная совместимость:** Новые шаблоны (офферы) и новые choice не ломают существующие контракты. Изменение signatory Holding ломает клиентов — если переходим на signatory holder, делать в новой версии модуля с миграцией.

---

## Реализованные изменения (итог)

Сделано по Варианту B и таблице рекомендаций:

1. **Common.Compliance:** добавлена `checkComplianceWithExpiry(record, level, asOfDate)` для проверки срока действия KYC.
2. **TreasuryBillToken:**
   - `key tokenId`, `maintainer issuer`; в ensure добавлено `outstandingSupply >= 0.0`.
   - **PurchaseTokens** — consuming, возвращает `(ContractId TreasuryBillToken, ContractId TreasuryBillHolding)`; уменьшает `outstandingSupply`; проверка `checkComplianceWithExpiry` (expirationDate).
   - **DistributeYield** — создаёт `YieldDistributionOffer` (не YieldPayment); assert `outstandingSupply > 0.0`; лимит батча 100.
   - **RedeemAtMaturity** — создаёт `RedemptionOffer`; получатель вызывает `AcceptRedemption` (архив holding, создание RedemptionReceipt).
   - В комментариях указана необходимость multi-party для UpdatePrice (issuer + custodian).
3. **TreasuryBillHolding:** key `(tokenId, holder)`, maintainer custodian. В **TransferHolding** добавлены опциональные `requiredComplianceLevel`, `allowedJurisdictions`, `asOfDate` — при передаче выполняется проверка compliance нового держателя. Добавлен шаблон **RedemptionOffer** и выбор **AcceptRedemption** (Propose-Accept для погашения).
4. **YieldDistribution:** ensure `amount > 0.0` у YieldPayment, RedemptionReceipt, RedemptionRequest. Шаблон **YieldDistributionOffer** и выбор **AcceptYieldOffer** (Propose-Accept для выплаты). У RedemptionReceipt добавлен выбор **ClaimRedemption**.

**Интеграция (TypeScript):** `exercisePurchaseTokens` возвращает `{ newTokenContractId, holdingContractId }`; treasuryBillsService обновляет кэш bill на новый contractId токена после покупки.

---

## Изменения API для DevNet и приложения

| Выбор / шаблон | Было | Стало |
|----------------|------|--------|
| PurchaseTokens | nonconsuming, возврат ContractId Holding | consuming, возврат (ContractId Token, ContractId Holding); multi-party (buyer + custodian) для создания Holding |
| DistributeYield | создаёт YieldPayment | создаёт YieldDistributionOffer; получатель вызывает AcceptYieldOffer → YieldPayment |
| RedeemAtMaturity | создаёт RedemptionReceipt, архивирует Holding | создаёт RedemptionOffer; получатель вызывает AcceptRedemption → архивирует Holding, создаёт RedemptionReceipt |
| TransferHolding | — | опциональные аргументы: requiredComplianceLevel, allowedJurisdictions, asOfDate (для проверки newHolder) |
| PartialRedeem / создание нового Holding | — | по-прежнему требует multi-party (holder + custodian) |

Для развёртывания в DevNet на вашей ноде: собрать DAR (`daml build`), загрузить DAR на participant, зарегистрировать партии (Issuer, Custodian, Investor, Regulator). Все создающие контракты с signatory другой стороны вызовы выполнять как multi-party submission или через Propose-Accept (AcceptYieldOffer, AcceptRedemption).
