# 05 — Existing DAML Contracts Specification

Complete reference of all 10 production DAML templates.

---

## Template Map

```
canton/daml/
├── OtcTypes.daml        — 105 LOC — Shared types, enums, validators
├── OtcOffer.daml        — 277 LOC — Main OTC trading contract
├── Escrow.daml          — 357 LOC — Multi-party escrow with arbitration
├── Collateral.daml      — 308 LOC — Collateral lock/release/forfeit
├── Settlement.daml      — 307 LOC — Payment confirmation + settlement
├── Test.daml            — 312 LOC — 6 test scenarios
└── daml.yaml            — SDK 2.9.3, LF 1.15

daml/src/
├── Common/Types.daml    — AssetClass, RiskRating, ComplianceLevel, KYCStatus
├── Common/Compliance.daml — ComplianceRecord, checkCompliance, checkJurisdiction
├── Treasury/TreasuryBillToken.daml    — T-Bill issuance + purchase + yield
├── Treasury/TreasuryBillHolding.daml  — Holder positions + transfers
└── Treasury/YieldDistribution.daml    — YieldPayment, RedemptionReceipt
```

---

## 1. OtcTypes.daml

### Enums
```daml
data OtcSide = Buy | Sell
  deriving (Eq, Show)

data OtcStatus
  = Pending | Active | PartiallyFilled | Filled
  | Cancelled | Expired | Disputed | Rejected
  deriving (Eq, Show)

data CollateralStatus
  = CollateralAvailable | CollateralLocked | CollateralReleased
  | CollateralForfeited | CollateralLiquidated
  deriving (Eq, Show)
```

### Records
```daml
data Asset = Asset with
  symbol : Text          -- e.g. "USDT", "CC"
  amount : Decimal       -- quantity
  chain : Text           -- e.g. "Canton", "Ethereum"
  contractAddress : Optional Text
    deriving (Eq, Show)

data Price = Price with
  rate : Decimal         -- e.g. 0.77
  currency : Text        -- e.g. "USD"
    deriving (Eq, Show)

data VolumeLimits = VolumeLimits with
  minAmount : Decimal
  maxAmount : Decimal
    deriving (Eq, Show)

data Timestamps = Timestamps with
  created : Time
  updated : Time
  expiresAt : Optional Time
    deriving (Eq, Show)

data SettlementInfo = SettlementInfo with
  settlementId : Text
  paymentProof : Text
  confirmations : Int
  completedAt : Optional Time
    deriving (Eq, Show)

data CollateralInfo = CollateralInfo with
  collateralId : Text
  asset : Asset
  lockedUntil : Time
  status : CollateralStatus
    deriving (Eq, Show)

data AcceptResult = AcceptResult with
  tradeId : Text
  actualQuantity : Decimal
  actualPrice : Decimal
  settlementTime : Time
  settlementId : Text
  slippageBps : Int
    deriving (Eq, Show)
```

### Validators
```daml
ensureAsset : Asset -> Bool
ensureAsset a = a.amount >= 0.0

ensurePrice : Price -> Bool
ensurePrice p = p.rate > 0.0

ensureVolumeLimits : VolumeLimits -> Bool
ensureVolumeLimits l = l.minAmount > 0.0 && l.maxAmount >= l.minAmount
```

---

## 2. OtcOffer.daml — 6 Choices

```
┌─────────────┐  Activate   ┌──────────┐  Accept   ┌──────────────────┐
│   Pending   │────────────→│  Active  │──────────→│ Filled / Partial │
└─────────────┘             └──────────┘           └──────────────────┘
                                │  │                         │
                         Cancel │  │ Expire           Settle │
                                ↓  ↓                         ↓
                          [Archived]                  [Archived/Filled]
                                │
                         Dispute│
                                ↓
                          ┌──────────┐
                          │ Disputed │
                          └──────────┘
```

**Key invariants:**
- `quantity > 0.0`
- `limits.minAmount > 0.0 && limits.maxAmount >= limits.minAmount && limits.maxAmount <= quantity`
- `price.rate > 0.0 && asset.amount > 0.0`
- `asset.amount == quantity`
- Self-trade prevention: `initiator != counterparty`
- Expiry: `expiresAt > created` (if present)

**Accept choice (most complex):**
- Validates: acceptor != initiator, not expired, status in [Active, PartiallyFilled]
- If counterparty specified: acceptor must match
- requestedQuantity in [minAmount, maxAmount] and <= quantity
- Generates tradeId and settlementId from offerId + acceptor + time
- Partial fill: creates new OtcOffer with remaining quantity, recalculated maxAmount
- Returns AcceptResult with slippageBps = 0

---

## 3. Escrow.daml — 10 Choices

```
┌─────────┐  Deposit  ┌───────────┐  Release      [Archived]
│ Created │─────────→│ Deposited │────────────→  (funds to seller)
└─────────┘          └───────────┘
     │                    │  │  │
     │ CancelEscrow       │  │  │ Refund → [Archived] (funds to buyer)
     ↓                    │  │  │
  [Archived]              │  │  │ PartialRelease → Escrow(reduced)
                          │  │
                   Dispute│  │ AutoExpire → [Archived]
                          ↓
                    ┌──────────┐  Arbitrate  ┌────────────┐  Execute
                    │ Disputed │───────────→│ Arbitrated │──────────→ [Archived]
                    └──────────┘            └────────────┘
```

**Key invariants:**
- `depositedAmount >= 0.0 && depositedAmount <= amount`
- Status consistency: Deposited → depositedAmount == amount; Created → depositedAmount == 0.0
- `extensionCount <= maxExtensions` (default max: 3)
- `deadline > createdAt`

---

## 4. Collateral.daml — 6 Choices + ForfeitedCollateral template

**Core invariant:** `(currentAmount + lockedAmount) == initialAmount`

```
┌───────────┐   Lock    ┌────────┐  Release  ┌──────────┐
│ Available │─────────→│ Locked │──────────→│ Released │
└───────────┘          └────────┘           └──────────┘
     ↑                    │  │
     │ TopUp              │  │ Forfeit → ForfeitedCollateral + [Archived]
     │                    │  │
     │ Withdraw           │  │ AutoRelease (after expiry)
     │                    │  ↓
     └────────────────────┘  → Available
```

**Lock constraints:** `lockDuration in (0h, 365d]`
**Forfeit:** Creates ForfeitedCollateral template for beneficiary with amount + reason

---

## 5. Settlement.daml — 8 Choices

```
┌────────────────┐  ConfirmPayment  ┌─────────────────┐  AddConfirmation(s)
│ PendingPayment │────────────────→│ PaymentReceived │───────────────────→
└────────────────┘                 └─────────────────┘
                                                           ┌───────────┐
                                          (N confirms) ───→│ Completed │
                                                           └───────────┘
Any state (except Completed):
  DisputeSettlement → Disputed → ResolveDispute → Confirming or Failed
  FailSettlement → [Archived]
  TimeoutSettlement (past deadline, PendingPayment|PaymentReceived) → [Archived]
  ExtendDeadline (max 3 extensions)
```

**Key invariant:** `totalAmount == quantity * price.rate`
**ConfirmPayment:** paymentTxHash length >= 32 characters
**AddConfirmation:** auto-transitions to Completed when confirmations >= requiredConfirmations

---

## 6. Treasury Templates

### TreasuryBillToken (nonconsuming choices)
- **PurchaseTokens**: compliance check → jurisdiction check → min/max investment → creates TreasuryBillHolding
- **DistributeYield**: maps over all holdings → creates proportional YieldPayment for each
- **RedeemAtMaturity**: checks maturity date → archives holding → creates RedemptionReceipt

### TreasuryBillHolding
- **TransferHolding**: partial/full transfer to new holder with new compliance record
- **PartialRedeem**: creates RedemptionRequest, returns reduced holding if partial
