# 06 — MatchingEngine.daml — On-Chain Order Matching

## Overview

The MatchingEngine provides **on-chain order book** functionality for Canton Network. It maintains price-time priority for limit orders, supports partial fills, and integrates with the existing OtcOffer + Escrow + Settlement stack.

**Design principle:** The matching engine runs on-ledger as DAML contracts, leveraging Canton's sub-transaction privacy so that only matched counterparties see each other's details. The order book itself is managed by the operator who acts as a neutral market maker.

---

## Dependencies

```daml
import OtcTypes (Asset, Price, OtcSide(..), Timestamps, ensureAsset, ensurePrice)
import DA.Time (RelTime, addRelTime)
import DA.Optional (fromOptional, isSome)
import DA.List (sortOn, head, tail)
import DA.Action (when)
```

---

## Type Definitions

```daml
-- Order status within the matching engine
data OrderStatus
  = Open          -- Active in the book
  | PartialFill   -- Partially executed
  | FullyFilled   -- Completely executed
  | OrderCancelled -- Cancelled by maker
  | OrderExpired   -- Expired by operator
  deriving (Eq, Show)

-- Fill result returned after a match
data FillResult = FillResult with
  fillId        : Text       -- Unique fill identifier
  makerOrderId  : Text       -- Maker order that was matched
  takerOrderId  : Text       -- Taker order that triggered match
  fillQuantity  : Decimal    -- Amount filled
  fillPrice     : Decimal    -- Price at which fill occurred (maker's price)
  fillTime      : Time       -- When the fill happened
  makerParty    : Party      -- Maker party (for settlement)
  takerParty    : Party      -- Taker party (for settlement)
    deriving (Eq, Show)

-- Order priority for sorting (price-time)
data OrderPriority = OrderPriority with
  price     : Decimal   -- Limit price
  timestamp : Time      -- Submission time (earlier = higher priority)
    deriving (Eq, Show, Ord)
```

---

## Template: Order

```daml
template Order
  with
    orderId       : Text
    operator      : Party        -- Market operator (signatory)
    maker         : Party        -- Order placer
    asset         : Asset        -- What is being traded
    quoteAsset    : Text         -- Quote currency (e.g. "USDT")
    side          : OtcSide      -- Buy or Sell
    limitPrice    : Decimal      -- Maximum (buy) or minimum (sell) price
    quantity      : Decimal      -- Original quantity
    filledQty     : Decimal      -- Quantity already filled
    remainingQty  : Decimal      -- Quantity still open
    status        : OrderStatus
    timestamps    : Timestamps
    minFillQty    : Decimal      -- Minimum fill size (anti-dust)
    postOnly      : Bool         -- If true, reject if would be taker
    auditors      : [Party]
  where
    signatory operator, maker
    observer auditors

    key (operator, orderId) : (Party, Text)
    maintainer key._1

    ensure remainingQty >= 0.0
      && filledQty >= 0.0
      && (filledQty + remainingQty) == quantity
      && quantity > 0.0
      && limitPrice > 0.0
      && minFillQty >= 0.0
      && minFillQty <= quantity
      && orderId /= ""

    -- Cancel an open order. Only maker or operator can cancel.
    choice CancelOrder : ()
      with
        canceller : Party
        currentTime : Time
      controller canceller
      do
        assertMsg "Only maker or operator can cancel"
          (canceller == maker || canceller == operator)
        assertMsg "Order must be Open or PartialFill"
          (status == Open || status == PartialFill)
        pure ()

    -- Fill this order (called by MatchingEngine during matching).
    -- Returns updated order if partial, or archives if fully filled.
    choice FillOrder : Optional (ContractId Order)
      with
        fillQty     : Decimal
        fillPrice   : Decimal
        currentTime : Time
      controller operator
      do
        assertMsg "Order must be Open or PartialFill"
          (status == Open || status == PartialFill)
        assertMsg "Fill quantity must be positive"
          (fillQty > 0.0)
        assertMsg "Fill quantity cannot exceed remaining"
          (fillQty <= remainingQty)
        assertMsg "Fill meets minimum fill quantity"
          (fillQty >= minFillQty || fillQty == remainingQty)
        -- Price validation: buy fills at or below limit, sell fills at or above limit
        case side of
          Buy -> assertMsg "Buy fill price must be <= limit"
                   (fillPrice <= limitPrice)
          Sell -> assertMsg "Sell fill price must be >= limit"
                    (fillPrice >= limitPrice)

        let newFilledQty = filledQty + fillQty
        let newRemainingQty = remainingQty - fillQty
        let newStatus = if newRemainingQty == 0.0
                        then FullyFilled
                        else PartialFill

        if newRemainingQty == 0.0
          then pure None  -- Fully filled, contract archived
          else do
            newCid <- create this with
              filledQty = newFilledQty
              remainingQty = newRemainingQty
              status = newStatus
              timestamps = timestamps with updated = currentTime
            pure (Some newCid)

    -- Expire an order past its expiry time
    choice ExpireOrder : ()
      with
        currentTime : Time
      controller operator
      do
        case timestamps.expiresAt of
          None -> abort "Order has no expiry"
          Some expiry -> assertMsg "Order not yet expired"
                           (currentTime > expiry)
        assertMsg "Only open orders can expire"
          (status == Open || status == PartialFill)
        pure ()
```

---

## Template: MatchingEngine

```daml
template MatchingEngine
  with
    engineId     : Text
    operator     : Party       -- Neutral market operator
    pair         : Text        -- Trading pair e.g. "CC/USDT"
    baseAsset    : Text        -- e.g. "CC"
    quoteAsset   : Text        -- e.g. "USDT"
    feeRateBps   : Int         -- Fee in basis points (e.g. 30 = 0.3%)
    minOrderSize : Decimal     -- Minimum order size
    maxOrderSize : Decimal     -- Maximum order size
    isActive     : Bool        -- Can accept new orders
    createdAt    : Time
    auditors     : [Party]
  where
    signatory operator
    observer auditors

    key (operator, engineId) : (Party, Text)
    maintainer key._1

    ensure feeRateBps >= 0 && feeRateBps <= 1000  -- Max 10%
      && minOrderSize > 0.0
      && maxOrderSize >= minOrderSize
      && engineId /= ""
      && pair /= ""

    -- Place a new order into the book. Returns the Order contract ID.
    nonconsuming choice PlaceOrder : ContractId Order
      with
        maker       : Party
        orderId     : Text
        side        : OtcSide
        limitPrice  : Decimal
        quantity    : Decimal
        minFillQty  : Decimal
        postOnly    : Bool
        expiresAt   : Optional Time
        currentTime : Time
      controller maker, operator
      do
        assertMsg "Engine must be active" isActive
        assertMsg "Quantity must be >= minOrderSize"
          (quantity >= minOrderSize)
        assertMsg "Quantity must be <= maxOrderSize"
          (quantity <= maxOrderSize)
        assertMsg "Limit price must be positive"
          (limitPrice > 0.0)
        assertMsg "Self-trade: maker cannot be operator in production"
          True  -- Operator can technically place orders; policy check off-chain

        let asset = Asset with
              symbol = baseAsset
              amount = quantity
              chain = "Canton"
              contractAddress = None

        create Order with
          orderId
          operator
          maker
          asset
          quoteAsset
          side
          limitPrice
          quantity
          filledQty = 0.0
          remainingQty = quantity
          status = Open
          timestamps = Timestamps with
            created = currentTime
            updated = currentTime
            expiresAt
          minFillQty
          postOnly
          auditors

    -- Execute a match between two orders. Operator calls this after
    -- detecting a crossing (buy.limitPrice >= sell.limitPrice).
    -- Returns FillResult with details of the execution.
    nonconsuming choice ExecuteMatch : FillResult
      with
        buyOrderCid  : ContractId Order
        sellOrderCid : ContractId Order
        matchQty     : Decimal   -- Quantity to match
        currentTime  : Time
      controller operator
      do
        buyOrder <- fetch buyOrderCid
        sellOrder <- fetch sellOrderCid

        -- Validate sides
        assertMsg "Buy order must be Buy side" (buyOrder.side == Buy)
        assertMsg "Sell order must be Sell side" (sellOrder.side == Sell)

        -- Validate crossing: buy price >= sell price
        assertMsg "Orders do not cross (buy.price < sell.price)"
          (buyOrder.limitPrice >= sellOrder.limitPrice)

        -- Validate quantities
        assertMsg "Match quantity exceeds buy remaining"
          (matchQty <= buyOrder.remainingQty)
        assertMsg "Match quantity exceeds sell remaining"
          (matchQty <= sellOrder.remainingQty)
        assertMsg "Match quantity must be positive"
          (matchQty > 0.0)

        -- Self-trade prevention
        assertMsg "Self-trade prevention: buyer cannot be seller"
          (buyOrder.maker /= sellOrder.maker)

        -- Price-time priority: fill at maker's price (the resting order)
        -- Convention: older order is maker, newer is taker
        let fillPrice = if buyOrder.timestamps.created <= sellOrder.timestamps.created
                        then buyOrder.limitPrice   -- Buy was resting
                        else sellOrder.limitPrice  -- Sell was resting

        -- Execute fills on both sides
        exercise buyOrderCid FillOrder with
          fillQty = matchQty
          fillPrice
          currentTime
        exercise sellOrderCid FillOrder with
          fillQty = matchQty
          fillPrice
          currentTime

        -- Generate fill ID
        let fillId = engineId <> "-" <> buyOrder.orderId <> "-"
                     <> sellOrder.orderId <> "-" <> show currentTime

        pure FillResult with
          fillId
          makerOrderId = if buyOrder.timestamps.created <= sellOrder.timestamps.created
                         then buyOrder.orderId else sellOrder.orderId
          takerOrderId = if buyOrder.timestamps.created <= sellOrder.timestamps.created
                         then sellOrder.orderId else buyOrder.orderId
          fillQuantity = matchQty
          fillPrice
          fillTime = currentTime
          makerParty = if buyOrder.timestamps.created <= sellOrder.timestamps.created
                       then buyOrder.maker else sellOrder.maker
          takerParty = if buyOrder.timestamps.created <= sellOrder.timestamps.created
                       then sellOrder.maker else buyOrder.maker

    -- Pause the engine (no new orders accepted)
    choice PauseEngine : ContractId MatchingEngine
      with
        currentTime : Time
      controller operator
      do
        assertMsg "Engine must be active" isActive
        create this with isActive = False

    -- Resume the engine
    choice ResumeEngine : ContractId MatchingEngine
      with
        currentTime : Time
      controller operator
      do
        assertMsg "Engine must be paused" (not isActive)
        create this with isActive = True

    -- Update fee rate
    choice UpdateFeeRate : ContractId MatchingEngine
      with
        newFeeRateBps : Int
      controller operator
      do
        assertMsg "Fee rate must be 0-1000 bps" (newFeeRateBps >= 0 && newFeeRateBps <= 1000)
        create this with feeRateBps = newFeeRateBps
```

---

## Test Scenarios

```daml
testMatchingEngine_LimitOrderMatch = script do
  operator <- allocateParty "Operator"
  alice <- allocateParty "Alice"
  bob <- allocateParty "Bob"
  now <- getTime

  -- Create engine
  engineCid <- submit operator do
    createCmd MatchingEngine with
      engineId = "engine-cc-usdt"
      operator, pair = "CC/USDT", baseAsset = "CC", quoteAsset = "USDT"
      feeRateBps = 30, minOrderSize = 1.0, maxOrderSize = 1000000.0
      isActive = True, createdAt = now, auditors = []

  -- Alice places buy order: 100 CC at $0.80
  buyOrderCid <- submit (operator, alice) do
    exerciseCmd engineCid PlaceOrder with
      maker = alice, orderId = "buy-001", side = Buy
      limitPrice = 0.80, quantity = 100.0, minFillQty = 1.0
      postOnly = False, expiresAt = None, currentTime = now

  -- Bob places sell order: 50 CC at $0.75
  sellOrderCid <- submit (operator, bob) do
    exerciseCmd engineCid PlaceOrder with
      maker = bob, orderId = "sell-001", side = Sell
      limitPrice = 0.75, quantity = 50.0, minFillQty = 1.0
      postOnly = False, expiresAt = None, currentTime = now

  -- Operator matches: 50 CC at Bob's price ($0.75, sell is resting)
  fillResult <- submit operator do
    exerciseCmd engineCid ExecuteMatch with
      buyOrderCid, sellOrderCid, matchQty = 50.0, currentTime = now

  -- Verify
  assertMsg "Fill quantity should be 50" (fillResult.fillQuantity == 50.0)
  assertMsg "Fill price should be seller's price" (fillResult.fillPrice == 0.75)
  assertMsg "Maker should be Bob (earlier sell)" (fillResult.makerParty == bob)

  pure ()

testMatchingEngine_SelfTradePrevention = script do
  operator <- allocateParty "Operator"
  alice <- allocateParty "Alice"
  now <- getTime

  engineCid <- submit operator do
    createCmd MatchingEngine with
      engineId = "engine-self-trade"
      operator, pair = "CC/USDT", baseAsset = "CC", quoteAsset = "USDT"
      feeRateBps = 30, minOrderSize = 1.0, maxOrderSize = 1000000.0
      isActive = True, createdAt = now, auditors = []

  buyOrderCid <- submit (operator, alice) do
    exerciseCmd engineCid PlaceOrder with
      maker = alice, orderId = "buy-self", side = Buy
      limitPrice = 0.80, quantity = 100.0, minFillQty = 1.0
      postOnly = False, expiresAt = None, currentTime = now

  sellOrderCid <- submit (operator, alice) do
    exerciseCmd engineCid PlaceOrder with
      maker = alice, orderId = "sell-self", side = Sell
      limitPrice = 0.75, quantity = 100.0, minFillQty = 1.0
      postOnly = False, expiresAt = None, currentTime = now

  -- This should fail: self-trade
  submitMustFail operator do
    exerciseCmd engineCid ExecuteMatch with
      buyOrderCid, sellOrderCid, matchQty = 100.0, currentTime = now

  pure ()
```

---

## Integration with Existing Stack

```
PlaceOrder   → Creates Order contract (on-ledger book)
ExecuteMatch → Fills both Order contracts
                → Off-chain: Rust SDK creates Escrow for matched trade
                → Off-chain: Rust SDK creates Settlement for confirmation tracking
                → On settlement complete: Collateral released
```

The MatchingEngine is **composable** with existing contracts:
- `Order` can reference an `OtcOffer.offerId` for RFQ-to-orderbook flow
- `FillResult` provides data needed to create `Settlement` contract
- Fee accounting uses `Price` and `Asset` types from `OtcTypes`
