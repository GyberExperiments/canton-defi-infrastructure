# 13 — Frontend Enhancements

## New Pages & Components

### 1. Orderbook Page (/trade/{pair})

**Real-time order book** with WebSocket streaming.

```
┌─────────────────────────────────────────────────────┐
│  CC/USDT                              24h Vol: 45K  │
├──────────────────┬──────────────────────────────────┤
│   ORDER BOOK     │        PRICE CHART               │
│                  │   ┌──────────────────────────┐   │
│  ASK (sells)     │   │   Candlestick chart      │   │
│  $0.82  120 CC   │   │   from PriceOracle data  │   │
│  $0.80  450 CC   │   │   TradingView-style      │   │
│  $0.79  200 CC   │   │                          │   │
│ ──── spread ──── │   └──────────────────────────┘   │
│  $0.77  500 CC   │                                  │
│  $0.75  300 CC   │   ┌──────────────────────────┐   │
│  $0.73  800 CC   │   │   TRADE FORM             │   │
│  BID (buys)      │   │   [Limit] [Market]       │   │
│                  │   │   Price: [____]           │   │
│  RECENT TRADES   │   │   Amount: [____] CC      │   │
│  $0.77 50 CC  ↑  │   │   Total: [____] USDT     │   │
│  $0.76 120 CC ↓  │   │   [BUY CC] [SELL CC]     │   │
│  $0.77 30 CC  ↑  │   └──────────────────────────┘   │
└──────────────────┴──────────────────────────────────┘
```

**Components:**
```
src/components/defi/
├── OrderBook.tsx           # Bid/ask depth visualization
├── PriceChart.tsx          # Candlestick chart (lightweight-charts)
├── TradeForm.tsx           # Limit/market order form
├── RecentTrades.tsx        # Trade history feed
├── DepthChart.tsx          # Depth visualization (optional)
└── PairSelector.tsx        # Trading pair dropdown
```

**WebSocket integration:**
```typescript
// hooks/useOrderBookStream.ts
export function useOrderBookStream(pair: string) {
  const [bids, setBids] = useState<PriceLevel[]>([]);
  const [asks, setAsks] = useState<PriceLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`wss://1otc.cc/api/v2/stream/orderbook?pair=${pair}`);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'snapshot': setBids(msg.bids); setAsks(msg.asks); break;
        case 'update': applyDelta(msg); break;
        case 'trade': setTrades(prev => [msg.trade, ...prev].slice(0, 50)); break;
      }
    };
    return () => ws.close();
  }, [pair]);

  return { bids, asks, trades };
}
```

### 2. Liquidity Pools Page (/pools)

```
┌──────────────────────────────────────────────┐
│  LIQUIDITY POOLS                              │
├──────────┬──────────┬────────┬───────────────┤
│  Pool    │  TVL     │  APY   │  Actions      │
├──────────┼──────────┼────────┼───────────────┤
│ CC/USDT  │ $154,000 │ 12.4%  │ [Add] [Remove]│
│ CC/USDC  │ $89,000  │ 8.7%   │ [Add] [Remove]│
│ CC/DAI   │ $45,000  │ 15.2%  │ [Add] [Remove]│
└──────────┴──────────┴────────┴───────────────┘

┌──────────────────────────────────────────────┐
│  ADD LIQUIDITY — CC/USDT                      │
│                                               │
│  CC Amount:  [_________] CC                   │
│  USDT Amount: [_________] USDT (auto-calc)   │
│                                               │
│  Pool Share: 2.3%                             │
│  LP Tokens:  2,300                            │
│  Exchange Rate: 1 CC = 0.77 USDT             │
│                                               │
│  [ADD LIQUIDITY]                              │
└──────────────────────────────────────────────┘
```

**Components:**
```
src/components/defi/
├── PoolList.tsx            # Pool overview table
├── PoolCard.tsx            # Individual pool card
├── AddLiquidity.tsx        # Deposit form with ratio calc
├── RemoveLiquidity.tsx     # Withdrawal form with slippage
├── PoolStats.tsx           # TVL, volume, APY charts
└── LPPositions.tsx         # User's LP positions
```

### 3. Portfolio Page (/portfolio)

```
┌──────────────────────────────────────────────┐
│  PORTFOLIO                    Total: $12,450  │
├──────────────────────────────────────────────┤
│  TOKEN BALANCES                               │
│  CC     5,000   $3,850  (+12.4% 24h)        │
│  USDT   8,600   $8,600                       │
│                                               │
│  LP POSITIONS                                 │
│  CC/USDT Pool  2,300 LP  $1,771  (APY 12.4%)│
│                                               │
│  OPEN ORDERS                                  │
│  Buy 200 CC @ $0.75  (limit, expires 24h)    │
│  Sell 100 CC @ $0.85  (limit, expires 48h)   │
│                                               │
│  TRADE HISTORY                                │
│  2026-02-24  Buy 500 CC @ $0.77  $385.00    │
│  2026-02-23  Sell 200 CC @ $0.80  $160.00   │
│  2026-02-22  Add LP 1000 CC + 770 USDT      │
└──────────────────────────────────────────────┘
```

### 4. CIP-0103 Wallet Connection

Replace current custom auth with standard CIP-0103 wallet connection:

```typescript
// lib/canton/wallet/cip0103.ts

interface CIP0103Provider {
  enable(): Promise<CIP0103API>;
  isEnabled(): Promise<boolean>;
}

interface CIP0103API {
  getPartyId(): Promise<string>;
  signTransaction(tx: DamlCommand[]): Promise<SignedTransaction>;
  getBalance(): Promise<TokenBalance[]>;
  onDisconnect(callback: () => void): void;
}

// hooks/useCantonWallet.ts
export function useCantonWallet() {
  const [provider, setProvider] = useState<CIP0103API | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = async () => {
    // Detect CIP-0103 providers (CC Bot, PartyLayer, etc.)
    const providers = detectCIP0103Providers();
    if (providers.length === 0) {
      // Fallback to EVM wallet + Canton auth
      return connectViaEVM();
    }
    const api = await providers[0].enable();
    setProvider(api);
    setPartyId(await api.getPartyId());
    setConnected(true);
  };

  return { connect, disconnect, partyId, connected, provider };
}
```

### 5. Real-Time Data Architecture

```
Browser ──WebSocket──→ Next.js API Route ──gRPC stream──→ Canton Participant
                       (server-side)                       (TransactionService)

Stream types:
  /api/v2/stream/orderbook  → Order create/archive/exercise events
  /api/v2/stream/trades     → FillResult events from MatchingEngine
  /api/v2/stream/prices     → PriceOracle SubmitPrice events
  /api/v2/stream/portfolio  → ACS changes for user's party
```

**Server-side streaming handler:**
```typescript
// app/api/v2/stream/orderbook/route.ts
export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Subscribe to Canton transaction stream
  const damlService = await getDamlService();
  const stream = await damlService.streamQuery('Order', {});

  stream.on('data', (event) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## New Dependencies

```json
{
  "lightweight-charts": "^4.1.0",   // TradingView charts
  "reconnecting-websocket": "^4.4", // Auto-reconnect WS
  "@tanstack/react-query": "^5.0",  // Server state management
  "react-virtuoso": "^4.7"          // Virtualized lists for orderbook
}
```
