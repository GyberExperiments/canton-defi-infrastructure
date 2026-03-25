# 08 — PriceOracle.daml + AtomicSwap + MultiPartySettlement + ComplianceGateway

This document covers the remaining 4 new DAML templates.

---

## 1. PriceOracle.daml — Decentralized Price Feeds

### Design

Multi-source price oracle with **median aggregation** and **staleness detection**. Authorized feeders submit prices, the oracle computes a weighted median, and any contract can query the latest price via nonconsuming choice.

### Type Definitions

```daml
data PricePoint = PricePoint with
  feeder      : Party
  asset       : Text         -- e.g. "CC/USDT"
  price       : Decimal
  confidence  : Decimal      -- 0.0 to 1.0
  source      : Text         -- e.g. "binance", "coingecko", "manual"
  submittedAt : Time
    deriving (Eq, Show)

data AggregatedPrice = AggregatedPrice with
  asset        : Text
  medianPrice  : Decimal
  meanPrice    : Decimal
  minPrice     : Decimal
  maxPrice     : Decimal
  numSources   : Int
  confidence   : Decimal     -- Average confidence across sources
  aggregatedAt : Time
    deriving (Eq, Show)
```

### Template: PriceOracle

```daml
template PriceOracle
  with
    oracleId        : Text
    operator        : Party
    asset           : Text              -- e.g. "CC/USDT"
    authorizedFeeders : [Party]         -- Whitelist of price feeders
    currentPrices   : [PricePoint]      -- Latest price from each feeder
    aggregated      : Optional AggregatedPrice  -- Last computed aggregate
    maxStaleness    : RelTime           -- Max age before price considered stale (e.g. 300s)
    minSources      : Int               -- Minimum sources for valid aggregate (e.g. 2)
    auditors        : [Party]
  where
    signatory operator
    observer authorizedFeeders ++ auditors

    key (operator, oracleId) : (Party, Text)
    maintainer key._1

    ensure minSources > 0
      && maxStaleness > seconds 0
      && oracleId /= ""

    -- Submit a price update from an authorized feeder
    choice SubmitPrice : ContractId PriceOracle
      with
        feeder     : Party
        price      : Decimal
        confidence : Decimal
        source     : Text
        currentTime : Time
      controller feeder
      do
        assertMsg "Feeder not authorized" (feeder `elem` authorizedFeeders)
        assertMsg "Price must be positive" (price > 0.0)
        assertMsg "Confidence must be 0-1" (confidence >= 0.0 && confidence <= 1.0)

        let newPoint = PricePoint with
              feeder, asset, price, confidence, source, submittedAt = currentTime

        -- Replace existing price from this feeder, or add new
        let otherPrices = filter (\p -> p.feeder /= feeder) currentPrices
        let updatedPrices = newPoint :: otherPrices

        -- Filter out stale prices
        let freshPrices = filter
              (\p -> addRelTime p.submittedAt maxStaleness > currentTime)
              updatedPrices

        -- Compute aggregate if enough sources
        let newAggregated =
              if length freshPrices >= minSources
              then
                let prices = map (.price) freshPrices
                    sorted = sortOn identity prices
                    n = length sorted
                    median = if n `mod` 2 == 1
                             then sorted !! (n / 2)
                             else (sorted !! (n / 2 - 1) + sorted !! (n / 2)) / 2.0
                    mean = foldl (+) 0.0 prices / intToDecimal n
                    minP = foldl1 min prices
                    maxP = foldl1 max prices
                    avgConf = foldl (+) 0.0 (map (.confidence) freshPrices) / intToDecimal n
                in Some AggregatedPrice with
                      asset
                      medianPrice = median
                      meanPrice = mean
                      minPrice = minP
                      maxPrice = maxP
                      numSources = n
                      confidence = avgConf
                      aggregatedAt = currentTime
              else aggregated  -- Keep old aggregate if not enough fresh sources

        create this with
          currentPrices = freshPrices
          aggregated = newAggregated

    -- Query the latest aggregated price (nonconsuming — anyone can read)
    nonconsuming choice QueryPrice : Optional AggregatedPrice
      with
        querier : Party
        currentTime : Time
      controller querier
      do
        -- Check staleness of aggregate
        case aggregated of
          None -> pure None
          Some agg ->
            if addRelTime agg.aggregatedAt maxStaleness > currentTime
            then pure (Some agg)
            else pure None  -- Aggregate is stale

    -- Add a new authorized feeder
    choice AddFeeder : ContractId PriceOracle
      with
        newFeeder : Party
      controller operator
      do
        assertMsg "Feeder already authorized" (newFeeder `notElem` authorizedFeeders)
        create this with authorizedFeeders = newFeeder :: authorizedFeeders

    -- Remove a feeder
    choice RemoveFeeder : ContractId PriceOracle
      with
        feederToRemove : Party
      controller operator
      do
        assertMsg "Feeder not found" (feederToRemove `elem` authorizedFeeders)
        let remaining = filter (/= feederToRemove) authorizedFeeders
        let cleanPrices = filter (\p -> p.feeder /= feederToRemove) currentPrices
        create this with
          authorizedFeeders = remaining
          currentPrices = cleanPrices
```

---

## 2. AtomicSwap.daml — Cross-Asset Atomic Swap with Timeout

### Design

Two-phase atomic swap: **Initiate** (lock both sides) → **Execute** (swap) or **Refund** (timeout). Uses Canton's atomic multi-party transactions for true atomicity.

```daml
data SwapStatus
  = SwapInitiated   -- Both parties have committed
  | SwapExecuted    -- Swap completed successfully
  | SwapRefunded    -- Timeout or cancellation, funds returned
  deriving (Eq, Show)

data SwapLeg = SwapLeg with
  party   : Party
  asset   : Text       -- Token symbol
  amount  : Decimal    -- Amount committed
  chain   : Text       -- "Canton" for native, or bridge chain
    deriving (Eq, Show)

template AtomicSwap
  with
    swapId      : Text
    operator    : Party
    legA        : SwapLeg      -- First leg (initiator gives)
    legB        : SwapLeg      -- Second leg (counterparty gives)
    status      : SwapStatus
    createdAt   : Time
    deadline    : Time         -- Auto-refund after this time
    escrowCidA  : Optional Text  -- Reference to Escrow contract for leg A
    escrowCidB  : Optional Text  -- Reference to Escrow contract for leg B
    auditors    : [Party]
  where
    signatory operator, legA.party, legB.party
    observer auditors

    key (operator, swapId) : (Party, Text)
    maintainer key._1

    ensure legA.amount > 0.0 && legB.amount > 0.0
      && legA.party /= legB.party
      && deadline > createdAt
      && swapId /= ""

    -- Execute the swap (operator triggers after both escrows funded)
    choice ExecuteSwap : ()
      with
        executor    : Party
        currentTime : Time
      controller executor
      do
        assertMsg "Only operator can execute" (executor == operator)
        assertMsg "Swap must be Initiated" (status == SwapInitiated)
        assertMsg "Must be before deadline" (currentTime <= deadline)
        assertMsg "Both escrows must be referenced"
          (isSome escrowCidA && isSome escrowCidB)
        -- Archives: off-chain SDK releases both escrows atomically
        pure ()

    -- Refund on timeout or mutual cancellation
    choice RefundSwap : ()
      with
        refunder    : Party
        reason      : Text
        currentTime : Time
      controller refunder
      do
        assertMsg "Swap must be Initiated" (status == SwapInitiated)
        let canRefund = refunder == operator
                     || (currentTime > deadline)
                     || (refunder == legA.party || refunder == legB.party)
        assertMsg "Not authorized to refund" canRefund
        assertMsg "Reason required" (reason /= "")
        -- Archives: off-chain SDK refunds both escrows
        pure ()

    -- Extend deadline (requires both parties + operator)
    choice ExtendSwapDeadline : ContractId AtomicSwap
      with
        newDeadline : Time
        currentTime : Time
      controller operator
      do
        assertMsg "New deadline must be in the future" (newDeadline > currentTime)
        assertMsg "New deadline must be after current" (newDeadline > deadline)
        create this with deadline = newDeadline
```

---

## 3. MultiPartySettlement.daml — Batch Netting

### Design

Settles multiple trades between N parties in a single atomic transaction. Computes net obligations per party, reducing the number of actual transfers.

```daml
data Obligation = Obligation with
  from    : Party
  to      : Party
  asset   : Text
  amount  : Decimal
    deriving (Eq, Show)

data NettedResult = NettedResult with
  party      : Party
  netAmounts : [(Text, Decimal)]  -- [(asset, netAmount)] positive = receive, negative = pay
    deriving (Eq, Show)

data BatchStatus
  = BatchPending     -- Collecting obligations
  | BatchNetting     -- Netting in progress
  | BatchSettled     -- All settled
  | BatchFailed      -- Settlement failed
  deriving (Eq, Show)

template MultiPartySettlement
  with
    batchId      : Text
    operator     : Party
    obligations  : [Obligation]     -- Raw obligations from trades
    participants : [Party]          -- All parties involved
    status       : BatchStatus
    createdAt    : Time
    deadline     : Time
    auditors     : [Party]
  where
    signatory operator
    observer participants ++ auditors

    key (operator, batchId) : (Party, Text)
    maintainer key._1

    ensure batchId /= "" && deadline > createdAt

    -- Add an obligation to the batch (from a matched trade)
    choice AddObligation : ContractId MultiPartySettlement
      with
        obligation : Obligation
        currentTime : Time
      controller operator
      do
        assertMsg "Batch must be Pending" (status == BatchPending)
        assertMsg "Amount must be positive" (obligation.amount > 0.0)
        assertMsg "Cannot owe self" (obligation.from /= obligation.to)
        assertMsg "Before deadline" (currentTime <= deadline)

        let newParticipants = dedup (obligation.from :: obligation.to :: participants)
        create this with
          obligations = obligation :: obligations
          participants = newParticipants

    -- Compute netting and execute settlement
    -- Returns list of net transfers (fewer than original obligations)
    choice ExecuteNetting : [Obligation]
      with
        currentTime : Time
      controller operator
      do
        assertMsg "Batch must be Pending" (status == BatchPending)
        assertMsg "Must have obligations" (not $ null obligations)
        assertMsg "Before deadline" (currentTime <= deadline)

        -- Compute net per (party, asset) pair
        -- For each party and asset: net = sum(received) - sum(paid)
        -- Then only create transfers for positive net amounts
        let allAssets = dedup $ map (.asset) obligations

        let netForPartyAsset party asset =
              let received = sum [o.amount | o <- obligations, o.to == party, o.asset == asset]
                  paid = sum [o.amount | o <- obligations, o.from == party, o.asset == asset]
              in received - paid

        -- Generate net transfer obligations (only where net > 0 indicates receiving)
        let netTransfers = do
              asset <- allAssets
              payer <- participants
              let net = netForPartyAsset payer asset
              -- If net < 0, this party owes |net| of this asset
              -- Find who they owe it to (simplified: operator collects and distributes)
              if net < 0.0
                then [Obligation with from = payer, to = operator, asset, amount = negate net]
                else []

        pure netTransfers

    -- Cancel the batch
    choice CancelBatch : ()
      with
        canceller : Party
        reason : Text
        currentTime : Time
      controller canceller
      do
        assertMsg "Only operator can cancel" (canceller == operator)
        assertMsg "Cannot cancel settled batch" (status /= BatchSettled)
        pure ()
```

---

## 4. ComplianceGateway.daml — Pluggable Compliance Checks

### Design

A compliance layer that validates trades against jurisdiction-specific rules without storing PII on-ledger. Compliance attestations are stored as opaque hashes — the gateway verifies the attestation is valid and not expired.

```daml
data ComplianceAttestation = ComplianceAttestation with
  investorParty   : Party
  attestationHash : Text        -- Hash of off-chain KYC record
  level           : Text        -- "RETAIL", "ACCREDITED", "INSTITUTIONAL"
  jurisdiction    : Text        -- ISO country code
  issuedAt        : Time
  expiresAt       : Time
  issuer          : Party       -- Compliance provider
    deriving (Eq, Show)

data ComplianceCheckResult = ComplianceCheckResult with
  approved       : Bool
  reason         : Text
  checkedAt      : Time
    deriving (Eq, Show)

template ComplianceGateway
  with
    gatewayId          : Text
    operator           : Party
    authorizedIssuers  : [Party]          -- Trusted compliance providers
    attestations       : [ComplianceAttestation]
    blockedJurisdictions : [Text]         -- Sanctioned jurisdictions
    requiredLevel      : Text             -- Minimum compliance level
    auditors           : [Party]
  where
    signatory operator
    observer authorizedIssuers ++ auditors

    key (operator, gatewayId) : (Party, Text)
    maintainer key._1

    ensure gatewayId /= ""

    -- Register a compliance attestation for an investor
    choice RegisterAttestation : ContractId ComplianceGateway
      with
        attestation : ComplianceAttestation
        currentTime : Time
      controller attestation.issuer
      do
        assertMsg "Issuer not authorized"
          (attestation.issuer `elem` authorizedIssuers)
        assertMsg "Attestation not expired"
          (attestation.expiresAt > currentTime)
        assertMsg "Hash must not be empty"
          (attestation.attestationHash /= "")

        -- Replace existing attestation for this party, or add new
        let others = filter
              (\a -> a.investorParty /= attestation.investorParty)
              attestations
        create this with attestations = attestation :: others

    -- Check if a party is compliant for trading
    -- This is nonconsuming so any contract can query it
    nonconsuming choice CheckCompliance : ComplianceCheckResult
      with
        party       : Party
        currentTime : Time
      controller operator
      do
        let maybeAttestation = find
              (\a -> a.investorParty == party) attestations

        case maybeAttestation of
          None -> pure ComplianceCheckResult with
            approved = False
            reason = "No attestation found for party"
            checkedAt = currentTime

          Some att ->
            if att.expiresAt <= currentTime
            then pure ComplianceCheckResult with
              approved = False
              reason = "Attestation expired"
              checkedAt = currentTime
            else if att.jurisdiction `elem` blockedJurisdictions
            then pure ComplianceCheckResult with
              approved = False
              reason = "Jurisdiction blocked: " <> att.jurisdiction
              checkedAt = currentTime
            else if att.level /= requiredLevel
                    && not (meetsLevel att.level requiredLevel)
            then pure ComplianceCheckResult with
              approved = False
              reason = "Insufficient compliance level: " <> att.level
                       <> " < " <> requiredLevel
              checkedAt = currentTime
            else pure ComplianceCheckResult with
              approved = True
              reason = "Compliance check passed"
              checkedAt = currentTime

    -- Add compliance issuer
    choice AddIssuer : ContractId ComplianceGateway
      with newIssuer : Party
      controller operator
      do create this with authorizedIssuers = newIssuer :: authorizedIssuers

    -- Block a jurisdiction
    choice BlockJurisdiction : ContractId ComplianceGateway
      with jurisdiction : Text
      controller operator
      do create this with blockedJurisdictions = jurisdiction :: blockedJurisdictions

-- Helper: check if level meets required level
meetsLevel : Text -> Text -> Bool
meetsLevel actual required =
  let levelOrder = [("RETAIL", 1), ("ACCREDITED", 2),
                    ("QUALIFIED_PURCHASER", 3), ("INSTITUTIONAL", 4)]
      getOrder l = fromOptional 0 $ lookup l levelOrder
  in getOrder actual >= getOrder required
```

---

## Integration Map — How All 16 Templates Work Together

```
                ComplianceGateway
                  │ CheckCompliance
                  ↓
User ──→ MatchingEngine.PlaceOrder ──→ Order (in book)
                  │
                  │ ExecuteMatch (when orders cross)
                  ↓
         ┌── FillResult ──┐
         │                 │
         ↓                 ↓
    AtomicSwap        Settlement
    (lock both)     (track confirms)
         │                 │
         ↓                 ↓
      Escrow            Escrow
    (buyer side)     (seller side)
         │                 │
         ↓                 ↓
    Collateral        Collateral
    (if required)    (if required)
         │                 │
         └──── Settle ─────┘
                  │
                  ↓
         MultiPartySettlement
         (batch netting for N trades)
                  │
                  ↓
           PriceOracle
         (mark-to-market)

Treasury integration:
  TreasuryBillToken.PurchaseTokens uses ComplianceGateway.CheckCompliance
  TreasuryBillHolding can be traded via MatchingEngine
  YieldPayment prices verified against PriceOracle
```
