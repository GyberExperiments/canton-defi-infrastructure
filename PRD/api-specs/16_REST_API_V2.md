# 16 — REST API v2 Specification

## Base URL

```
Production: https://1otc.cc/api/v2
Local:      http://localhost:8080/api/v2
```

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <JWT>
```

JWT obtained via CIP-0103 wallet connection or EVM signature flow.

---

## Endpoints

### Health & Status

```yaml
GET /health
  Response 200:
    status: "healthy" | "degraded"
    connected: boolean
    mode: "daml-ledger-api-v2"
    version: "2.0.0"
    ledger_end: string
    uptime_seconds: number
    services:
      matching_engine: "up" | "down"
      price_oracle: "up" | "down"
      settlement: "up" | "down"
```

### Orders (MatchingEngine)

```yaml
POST /v2/orders
  Description: Place a new order
  Auth: Required
  Body:
    pair: string              # "CC/USDT"
    side: "buy" | "sell"
    type: "limit" | "market"
    price: string             # Decimal as string (required for limit)
    quantity: string           # Decimal as string
    min_fill_qty: string       # Optional, default "0"
    post_only: boolean         # Optional, default false
    expires_in: number         # Optional, seconds until expiry
  Response 201:
    order_id: string
    contract_id: string
    status: "open"
    created_at: string        # ISO 8601

GET /v2/orders
  Description: List user's orders
  Auth: Required
  Query:
    status: "open" | "partial" | "filled" | "cancelled"  # Optional filter
    pair: string              # Optional filter
    limit: number             # Default 50, max 200
    offset: number            # Default 0
  Response 200:
    orders: Order[]
    total: number

GET /v2/orders/{orderId}
  Auth: Required
  Response 200: Order

DELETE /v2/orders/{orderId}
  Description: Cancel an order
  Auth: Required
  Response 200:
    cancelled: true
    order_id: string

GET /v2/orderbook/{pair}
  Description: Get current orderbook
  Auth: None (public)
  Query:
    depth: number             # Number of price levels (default 20)
  Response 200:
    pair: string
    bids: PriceLevel[]        # [{price, quantity, orders}] sorted desc
    asks: PriceLevel[]        # [{price, quantity, orders}] sorted asc
    spread: string
    mid_price: string
    timestamp: string
```

### Swaps (AtomicSwap)

```yaml
POST /v2/swap
  Description: Initiate an atomic swap
  Auth: Required
  Body:
    give_asset: string        # Token to give
    give_amount: string
    receive_asset: string     # Token to receive
    receive_amount: string    # Expected amount (slippage check)
    max_slippage_bps: number  # Max acceptable slippage (default 50)
    deadline_seconds: number  # Swap deadline (default 3600)
  Response 201:
    swap_id: string
    contract_id: string
    status: "initiated"
    escrow_a: string          # Escrow contract for your side
    deadline: string

POST /v2/swap/{swapId}/execute
  Auth: Required
  Response 200:
    status: "executed"
    tx_hash: string

POST /v2/swap/{swapId}/refund
  Auth: Required
  Body:
    reason: string
  Response 200:
    status: "refunded"
```

### Liquidity Pools

```yaml
GET /v2/pools
  Auth: None (public)
  Response 200:
    pools: Pool[]
    # Pool: { pool_id, token_a, token_b, reserve_a, reserve_b,
    #         total_lp_tokens, fee_bps, tvl_usd, apy_24h, volume_24h }

GET /v2/pools/{poolId}
  Auth: None
  Response 200: Pool (detailed with price history)

POST /v2/pools/{poolId}/add
  Description: Add liquidity
  Auth: Required
  Body:
    amount_a: string
    amount_b: string          # Will be auto-adjusted to match ratio
    min_lp_tokens: string     # Slippage protection
  Response 201:
    lp_tokens: string
    actual_amount_a: string
    actual_amount_b: string
    pool_share: string        # Percentage

POST /v2/pools/{poolId}/remove
  Auth: Required
  Body:
    lp_tokens: string         # LP tokens to burn
    min_amount_a: string      # Slippage protection
    min_amount_b: string
  Response 200:
    amount_a: string
    amount_b: string

POST /v2/pools/{poolId}/swap
  Description: Swap via pool (AMM)
  Auth: Required
  Body:
    direction: "a_to_b" | "b_to_a"
    amount_in: string
    min_amount_out: string    # Slippage protection
  Response 200:
    swap_result:
      amount_in: string
      amount_out: string
      fee: string
      price_impact_bps: number
      executed_price: string

GET /v2/pools/{poolId}/positions
  Description: User's LP positions
  Auth: Required
  Response 200:
    positions: LPPosition[]
```

### Price Oracle

```yaml
GET /v2/oracle/price/{asset}
  Description: Get latest aggregated price
  Auth: None (public)
  Response 200:
    asset: string             # e.g. "CC/USDT"
    price: string             # Median price
    confidence: number        # 0.0-1.0
    sources: number           # Number of price feeders
    timestamp: string
    min_price: string
    max_price: string

GET /v2/oracle/history/{asset}
  Query:
    interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
    limit: number             # Default 100
  Response 200:
    candles: Candle[]
    # Candle: { open, high, low, close, volume, timestamp }

POST /v2/oracle/submit
  Description: Submit price (authorized feeders only)
  Auth: Required (feeder role)
  Body:
    asset: string
    price: string
    confidence: number
    source: string
  Response 201:
    accepted: true
```

### Settlement

```yaml
POST /v2/settle/batch
  Description: Create batch settlement
  Auth: Required (operator)
  Body:
    obligations: Obligation[]
    # Obligation: { from, to, asset, amount }
    deadline_hours: number    # Default 72
  Response 201:
    batch_id: string
    participants: string[]
    net_transfers: Obligation[]  # Netted result

GET /v2/settle/{batchId}
  Auth: Required
  Response 200: BatchSettlement

POST /v2/settle/{batchId}/execute
  Auth: Required (operator)
  Response 200:
    status: "settled"
    transfers: Transfer[]
```

### Portfolio

```yaml
GET /v2/portfolio
  Description: User's complete portfolio
  Auth: Required
  Response 200:
    balances: TokenBalance[]
    # TokenBalance: { asset, amount, value_usd, change_24h_pct }
    lp_positions: LPPosition[]
    open_orders: Order[]
    pending_settlements: Settlement[]
    total_value_usd: string

GET /v2/portfolio/history
  Query:
    period: "7d" | "30d" | "90d" | "1y"
  Response 200:
    snapshots: PortfolioSnapshot[]
    pnl: string               # Total P&L for period
    pnl_pct: string
```

### Compliance

```yaml
POST /v2/compliance/check
  Auth: Required
  Response 200:
    approved: boolean
    level: string             # "RETAIL" | "ACCREDITED" | "INSTITUTIONAL"
    jurisdiction: string
    expires_at: string

POST /v2/compliance/attest
  Auth: Required (issuer role)
  Body:
    investor_party: string
    level: string
    jurisdiction: string
    attestation_hash: string  # Hash of off-chain KYC record
    expires_at: string
  Response 201:
    registered: true
```

---

## WebSocket Streams

```yaml
WS /v2/stream/orderbook?pair=CC/USDT
  Messages:
    { type: "snapshot", bids: [...], asks: [...] }
    { type: "update", side: "bid"|"ask", price: "0.77", quantity: "500" }
    { type: "trade", fill_id: "...", price: "0.77", quantity: "50", side: "buy" }

WS /v2/stream/prices?asset=CC/USDT
  Messages:
    { type: "price", asset: "CC/USDT", price: "0.77", confidence: 0.95, timestamp: "..." }

WS /v2/stream/portfolio?party=alice
  Auth: Required (token in query)
  Messages:
    { type: "balance_update", asset: "CC", amount: "5000" }
    { type: "order_update", order_id: "...", status: "filled" }
    { type: "settlement", settlement_id: "...", status: "completed" }
```

---

## Error Format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Not enough CC to place sell order",
    "details": {
      "required": "500",
      "available": "200"
    }
  }
}
```

Error codes: `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_BALANCE`, `SLIPPAGE_EXCEEDED`, `ORDER_EXPIRED`, `COMPLIANCE_FAILED`, `CIRCUIT_OPEN`, `RATE_LIMITED`, `INTERNAL_ERROR`
