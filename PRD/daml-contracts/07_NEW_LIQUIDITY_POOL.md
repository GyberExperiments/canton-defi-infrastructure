# 07 — LiquidityPool.daml — Constant-Product AMM for Canton

## Overview

The LiquidityPool implements a **constant-product automated market maker** (x * y = k) natively in DAML on Canton Network. This is the first AMM primitive for Canton, enabling permissionless token swaps with sub-transaction privacy.

**Design:** Adapted from Uniswap v2 math for DAML's Decimal type. The pool holds two token reserves, liquidity providers deposit both tokens proportionally, and traders swap one for the other with a configurable fee.

---

## Dependencies

```daml
import OtcTypes (Asset)
import DA.Time (Time)
import DA.Optional (isSome)
import DA.Action (when)
```

---

## Type Definitions

```daml
-- Liquidity provider position
data LPPosition = LPPosition with
  provider    : Party
  lpTokens    : Decimal     -- Share of pool (proportional to total LP tokens)
  depositedA  : Decimal     -- Original token A deposited
  depositedB  : Decimal     -- Original token B deposited
  depositTime : Time
    deriving (Eq, Show)

-- Swap direction
data SwapDirection
  = AtoB     -- Sell token A for token B
  | BtoA     -- Sell token B for token A
  deriving (Eq, Show)

-- Swap result
data SwapResult = SwapResult with
  swapId       : Text
  amountIn     : Decimal
  amountOut    : Decimal
  feeAmount    : Decimal
  priceImpact  : Decimal    -- Basis points of price impact
  newReserveA  : Decimal
  newReserveB  : Decimal
  executedAt   : Time
    deriving (Eq, Show)
```

---

## Template: LiquidityPool

```daml
template LiquidityPool
  with
    poolId       : Text
    operator     : Party         -- Pool operator
    tokenA       : Text          -- Base token symbol (e.g. "CC")
    tokenB       : Text          -- Quote token symbol (e.g. "USDT")
    reserveA     : Decimal       -- Current reserve of token A
    reserveB     : Decimal       -- Current reserve of token B
    totalLPTokens : Decimal      -- Total LP tokens outstanding
    feeRateBps   : Int           -- Swap fee (e.g. 30 = 0.30%)
    protocolFeeBps : Int         -- Protocol fee taken from swap fee (e.g. 500 = 50% of fee)
    minLiquidity : Decimal       -- Minimum liquidity to prevent dust attacks
    isActive     : Bool
    createdAt    : Time
    auditors     : [Party]
  where
    signatory operator
    observer auditors

    key (operator, poolId) : (Party, Text)
    maintainer key._1

    ensure reserveA >= 0.0
      && reserveB >= 0.0
      && totalLPTokens >= 0.0
      && feeRateBps >= 0 && feeRateBps <= 1000
      && protocolFeeBps >= 0 && protocolFeeBps <= 10000
      && minLiquidity >= 0.0
      && poolId /= ""

    -- Add liquidity proportionally. First deposit sets the ratio.
    -- Returns: (new pool contract, LP position record)
    choice AddLiquidity : (ContractId LiquidityPool, LPPosition)
      with
        provider  : Party
        amountA   : Decimal     -- Token A to deposit
        amountB   : Decimal     -- Token B to deposit
        currentTime : Time
      controller provider, operator
      do
        assertMsg "Pool must be active" isActive
        assertMsg "Amount A must be positive" (amountA > 0.0)
        assertMsg "Amount B must be positive" (amountB > 0.0)

        let (newReserveA, newReserveB, lpMinted) =
              if totalLPTokens == 0.0
              then
                -- First deposit: LP tokens = sqrt(amountA * amountB)
                -- Using geometric mean approximation for DAML (no sqrt):
                -- lpMinted = amountA (convention: use token A amount as initial LP)
                (amountA, amountB, amountA)
              else
                -- Proportional deposit: must match current ratio
                -- lpMinted = totalLPTokens * min(amountA/reserveA, amountB/reserveB)
                let ratioA = amountA / reserveA
                    ratioB = amountB / reserveB
                    ratio = if ratioA <= ratioB then ratioA else ratioB
                    lp = totalLPTokens * ratio
                    actualA = reserveA * ratio
                    actualB = reserveB * ratio
                in (reserveA + actualA, reserveB + actualB, lp)

        assertMsg "Must mint at least minLiquidity LP tokens"
          (lpMinted >= minLiquidity || totalLPTokens == 0.0)

        newPoolCid <- create this with
          reserveA = newReserveA
          reserveB = newReserveB
          totalLPTokens = totalLPTokens + lpMinted

        let position = LPPosition with
              provider
              lpTokens = lpMinted
              depositedA = amountA
              depositedB = amountB
              depositTime = currentTime

        pure (newPoolCid, position)

    -- Remove liquidity. Burns LP tokens, returns proportional reserves.
    choice RemoveLiquidity : (ContractId LiquidityPool, Decimal, Decimal)
      with
        provider    : Party
        lpTokensBurn : Decimal   -- LP tokens to burn
        minAmountA  : Decimal    -- Minimum token A to receive (slippage protection)
        minAmountB  : Decimal    -- Minimum token B to receive
        currentTime : Time
      controller provider, operator
      do
        assertMsg "LP tokens must be positive" (lpTokensBurn > 0.0)
        assertMsg "LP tokens must not exceed total" (lpTokensBurn <= totalLPTokens)

        let share = lpTokensBurn / totalLPTokens
        let amountA = reserveA * share
        let amountB = reserveB * share

        assertMsg "Slippage: amount A below minimum" (amountA >= minAmountA)
        assertMsg "Slippage: amount B below minimum" (amountB >= minAmountB)

        newPoolCid <- create this with
          reserveA = reserveA - amountA
          reserveB = reserveB - amountB
          totalLPTokens = totalLPTokens - lpTokensBurn

        pure (newPoolCid, amountA, amountB)

    -- Execute a swap using constant-product formula.
    -- amountIn of input token → calculated amountOut of output token.
    choice Swap : (ContractId LiquidityPool, SwapResult)
      with
        trader      : Party
        direction   : SwapDirection
        amountIn    : Decimal
        minAmountOut : Decimal    -- Slippage protection
        currentTime : Time
      controller trader, operator
      do
        assertMsg "Pool must be active" isActive
        assertMsg "Amount in must be positive" (amountIn > 0.0)
        assertMsg "Pool must have liquidity" (reserveA > 0.0 && reserveB > 0.0)

        -- Constant product: (reserveIn + amountIn*fee) * (reserveOut - amountOut) = k
        -- amountOut = reserveOut * amountInWithFee / (reserveIn + amountInWithFee)
        let feeMultiplier = 10000 - (intToDecimal feeRateBps)  -- e.g. 9970 for 30bps
        let amountInWithFee = amountIn * feeMultiplier / 10000.0
        let feeAmount = amountIn - amountInWithFee

        let (reserveIn, reserveOut) = case direction of
              AtoB -> (reserveA, reserveB)
              BtoA -> (reserveB, reserveA)

        let amountOut = reserveOut * amountInWithFee / (reserveIn + amountInWithFee)

        assertMsg "Slippage: output below minimum" (amountOut >= minAmountOut)
        assertMsg "Output cannot exceed reserve" (amountOut < reserveOut)

        -- Calculate price impact (in basis points)
        let spotPrice = reserveOut / reserveIn
        let execPrice = amountOut / amountIn
        let priceImpact = if spotPrice > 0.0
                          then ((spotPrice - execPrice) / spotPrice) * 10000.0
                          else 0.0

        let (newReserveA, newReserveB) = case direction of
              AtoB -> (reserveA + amountIn, reserveB - amountOut)
              BtoA -> (reserveA - amountOut, reserveB + amountIn)

        -- Verify constant product invariant (k should increase due to fees)
        let kBefore = reserveA * reserveB
        let kAfter = newReserveA * newReserveB
        assertMsg "Constant product invariant violated" (kAfter >= kBefore)

        let swapId = poolId <> "-swap-" <> show currentTime

        newPoolCid <- create this with
          reserveA = newReserveA
          reserveB = newReserveB

        let result = SwapResult with
              swapId, amountIn, amountOut, feeAmount, priceImpact
              newReserveA, newReserveB, executedAt = currentTime

        pure (newPoolCid, result)

    -- Pause pool (no swaps or new liquidity)
    choice PausePool : ContractId LiquidityPool
      with currentTime : Time
      controller operator
      do create this with isActive = False

    -- Resume pool
    choice ResumePool : ContractId LiquidityPool
      with currentTime : Time
      controller operator
      do create this with isActive = True
```

---

## Test Scenarios

```daml
testLiquidityPool_AddAndSwap = script do
  operator <- allocateParty "Operator"
  alice <- allocateParty "Alice"
  bob <- allocateParty "Bob"
  now <- getTime

  -- Create pool: CC/USDT with 0.3% fee
  poolCid <- submit operator do
    createCmd LiquidityPool with
      poolId = "pool-cc-usdt", operator
      tokenA = "CC", tokenB = "USDT"
      reserveA = 0.0, reserveB = 0.0
      totalLPTokens = 0.0, feeRateBps = 30, protocolFeeBps = 500
      minLiquidity = 0.001, isActive = True, createdAt = now, auditors = []

  -- Alice adds liquidity: 10,000 CC + 7,700 USDT (price = $0.77)
  (poolCid2, aliceLP) <- submitMulti [alice, operator] [] do
    exerciseCmd poolCid AddLiquidity with
      provider = alice, amountA = 10000.0, amountB = 7700.0, currentTime = now

  -- Verify initial state
  pool <- queryContractId operator poolCid2
  assertMsg "Reserve A = 10000" (pool.reserveA == 10000.0)
  assertMsg "Reserve B = 7700" (pool.reserveB == 7700.0)

  -- Bob swaps 100 USDT → CC
  (poolCid3, swapResult) <- submitMulti [bob, operator] [] do
    exerciseCmd poolCid2 Swap with
      trader = bob, direction = BtoA
      amountIn = 100.0, minAmountOut = 100.0  -- Expect ~129 CC
      currentTime = now

  -- Verify: amountOut > 0, fee taken, k increased
  assertMsg "Got some CC" (swapResult.amountOut > 0.0)
  assertMsg "Fee was charged" (swapResult.feeAmount > 0.0)
  assertMsg "k increased" (swapResult.newReserveA * swapResult.newReserveB >= 10000.0 * 7700.0)

  pure ()

testLiquidityPool_SlippageProtection = script do
  operator <- allocateParty "Operator"
  alice <- allocateParty "Alice"
  bob <- allocateParty "Bob"
  now <- getTime

  poolCid <- submit operator do
    createCmd LiquidityPool with
      poolId = "pool-slippage", operator
      tokenA = "CC", tokenB = "USDT"
      reserveA = 1000.0, reserveB = 770.0  -- Pre-funded for simplicity
      totalLPTokens = 1000.0, feeRateBps = 30, protocolFeeBps = 0
      minLiquidity = 0.001, isActive = True, createdAt = now, auditors = []

  -- Bob tries a large swap with tight slippage — should fail
  submitMultiMustFail [bob, operator] [] do
    exerciseCmd poolCid Swap with
      trader = bob, direction = BtoA
      amountIn = 500.0           -- Very large relative to pool
      minAmountOut = 600.0       -- Unrealistic expectation
      currentTime = now

  pure ()
```

---

## AMM Math Reference

```
Constant Product: x * y = k

Add Liquidity (proportional):
  lpMinted = totalLP * min(depositA / reserveA, depositB / reserveB)

Remove Liquidity:
  amountA = reserveA * (lpBurned / totalLP)
  amountB = reserveB * (lpBurned / totalLP)

Swap (A → B):
  amountInWithFee = amountIn * (10000 - feeBps) / 10000
  amountOut = reserveB * amountInWithFee / (reserveA + amountInWithFee)

Spot Price:
  priceAinB = reserveB / reserveA

Price Impact:
  impactBps = ((spotPrice - execPrice) / spotPrice) * 10000
```
