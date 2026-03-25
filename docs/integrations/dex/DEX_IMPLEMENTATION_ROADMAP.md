# 🚀 DEX Implementation Roadmap - 1OTC DEX

**Дата:** 2 Ноября 2025  
**Версия:** 1.0  
**Статус:** Comprehensive Implementation Plan

---

## 📊 Executive Summary

Это comprehensive план для превращения текущей примитивной DEX в продвинутую боевую версию на базе NEAR Intents. План разделен на 4 фазы с детальными шагами для каждой.

**Текущий статус:**
- ✅ **Фаза 1 (Дизайн Аудит):** ЗАВЕРШЕНА
- 🔄 **Фаза 2 (NEAR Intents Интеграция):** ГОТОВА К СТАРТУ
- ⏳ **Фаза 3 (Advanced Features):** ЗАПЛАНИРОВАНА
- ⏳ **Фаза 4 (Professional UI/UX):** ЗАПЛАНИРОВАНА

---

## ✅ ФАЗА 1: Дизайн Аудит и Исправления (ЗАВЕРШЕНО)

### Выполненные Задачи:

#### 1.1 Полный Дизайн Аудит ✅
- Проанализировано 57 проблем в 8 категориях
- Создана детальная документация: `DESIGN_AUDIT_RESULTS.md`
- Определены приоритеты: 13 критичных, 33 важных, 11 низких

#### 1.2 SwapInterface.tsx Исправления ✅
**Изменения:**
- ✅ Responsive breakpoints везде (p-4 md:p-6 lg:p-12)
- ✅ Fluid typography (text-fluid-sm, text-fluid-2xl)
- ✅ Flex-wrap для mobile compatibility
- ✅ Улучшенная swap arrow анимация с rotation
- ✅ Semantic colors (text-error, text-warning, text-success)
- ✅ Консистентный spacing (gap-2 md:gap-3)
- ✅ Адаптивный layout (flex-col sm:flex-row)

**Результат:** SwapInterface теперь полностью responsive и следует design system

#### 1.3 BridgeInterface.tsx Исправления ✅
**Изменения:**
- ✅ Emoji заменены на SVG иконки (Lucide React - Circle, Hexagon)
- ✅ Каждая chain имеет уникальный цвет и IconComponent
- ✅ Улучшенная bridge animation (rotation + pulse effect)
- ✅ Responsive breakpoints (p-4 md:p-6)
- ✅ Fluid typography везде
- ✅ Адаптивные chain buttons (px-3 py-2 md:px-6 md:py-3)

**Результат:** BridgeInterface professional-grade UI с proper SVG icons

#### 1.4 NearWalletButton.tsx Исправления ✅
**Изменения:**
- ✅ Responsive layout (flex-col sm:flex-row)
- ✅ Правильное выравнивание на всех экранах
- ✅ Fluid typography
- ✅ Consistent spacing (gap-3 sm:gap-4)
- ✅ Breakable account ID (break-all для длинных адресов)
- ✅ Full-width на mobile, auto на desktop

**Результат:** Perfect mobile/desktop experience

#### 1.5 IntentHistory.tsx Исправления ✅
**Изменения:**
- ✅ Убраны magic numbers (60000, 3600000, 86400000)
- ✅ Созданы константы (MINUTE_MS, HOUR_MS, DAY_MS)
- ✅ Fluid typography везде
- ✅ Responsive layout (flex-col sm:flex-row)
- ✅ Улучшенный spacing (p-4 md:p-6)
- ✅ Адаптивные history items

**Результат:** Clean code, полная responsive адаптация

#### 1.6 Документация ✅
Созданы:
- ✅ `NEAR_INTENTS_CAPABILITIES.md` - 400+ строк, полный список возможностей (4 тира, 20+ features)
- ✅ `DESIGN_AUDIT_RESULTS.md` - 600+ строк, детальный аудит всех проблем
- ✅ `DEX_IMPLEMENTATION_ROADMAP.md` - этот файл, comprehensive план

---

## 🔄 ФАЗА 2: NEAR Intents Real Integration

**Статус:** 🟢 В ПРОЦЕССЕ (75% завершено)  
**Оценка времени:** 2-3 недели  
**Приоритет:** 🔴 HIGH

### ✅ Выполнено:
- ✅ 2.1.2 Создан NEAR SDK Wrapper (`near-intents-sdk.ts`)
- ✅ 2.1.3 Обновлен `near-intents.ts` для использования SDK
- ✅ 2.2.1 Swap Endpoint улучшен с SDK интеграцией
- ✅ 2.2.2 Bridge Endpoint улучшен с SDK интеграцией
- ✅ 2.2.3 Status Endpoint переписан с использованием SDK
- ✅ 2.2.4 Создан User Intents Endpoint
- ✅ 2.3 Solver System - базовая структура создана
- ✅ 2.4 Price Oracle Integration (завершено ранее)

**Детальный статус:** См. `PHASE2_IMPLEMENTATION_STATUS.md`  
**Solver System:** См. `SOLVER_SYSTEM_EXPLAINED.md`

### 2.1 Smart Contract Integration

**Задача:** Интеграция с реальным NEAR Intents смарт-контрактом

**Текущая проблема:**
```typescript
// Сейчас: Mock API calls
const response = await fetch('/api/near-intents/swap', {...})

// Эти endpoints не существуют!
```

**Что нужно сделать:**

#### 2.1.1 Изучить NEAR Intents Smart Contract
```bash
# Клонировать репозиторий
git clone https://github.com/near/intents
cd intents

# Изучить структуру контракта
cat contracts/intents/src/lib.rs

# Понять методы:
# - create_intent()
# - fulfill_intent()
# - cancel_intent()
# - get_intent_status()
```

**Документация:**
- GitHub: https://github.com/near/intents
- Docs: https://docs.near.org/concepts/intents

#### 2.1.2 Создать NEAR SDK Wrapper
```typescript
// src/lib/near-intents-sdk.ts

import { connect, Contract, keyStores, WalletConnection } from 'near-api-js';

interface IntentsContract {
  create_swap_intent(args: {
    from_token: string;
    to_token: string;
    amount: string;
    min_receive: string;
    deadline: number;
  }): Promise<string>; // Возвращает intent_id
  
  get_intent_status(args: {
    intent_id: string;
  }): Promise<{
    status: 'pending' | 'filled' | 'expired' | 'cancelled';
    solver?: string;
    filled_at?: number;
    transaction_hash?: string;
  }>;
}

export async function initNearIntents(
  networkId: 'testnet' | 'mainnet'
): Promise<Contract & IntentsContract> {
  const config = {
    networkId,
    keyStore: new keyStores.BrowserLocalStorageKeyStore(),
    nodeUrl: `https://rpc.${networkId}.near.org`,
    walletUrl: `https://wallet.${networkId}.near.org`,
    helperUrl: `https://helper.${networkId}.near.org`,
    explorerUrl: `https://explorer.${networkId}.near.org`,
  };

  const near = await connect(config);
  const wallet = new WalletConnection(near, 'canton-otc-dex');

  const contract = new Contract(
    wallet.account(),
    'intents.near', // Contract address на testnet/mainnet
    {
      viewMethods: ['get_intent_status', 'get_intents_by_user'],
      changeMethods: ['create_swap_intent', 'cancel_intent'],
    }
  ) as Contract & IntentsContract;

  return contract;
}
```

#### 2.1.3 Обновить near-intents.ts
```typescript
// src/lib/near-intents.ts

import { initNearIntents } from './near-intents-sdk';

export async function createSwapIntent(params: SwapIntentParams): Promise<IntentResult> {
  try {
    // Инициализируем контракт
    const contract = await initNearIntents(
      process.env.NEXT_PUBLIC_NEAR_NETWORK as 'mainnet' | 'testnet'
    );

    // Конвертируем amount в yoctoNEAR или правильные decimals
    const amount = BigInt(params.amount * Math.pow(10, 24)); // Для NEAR

    // Создаем intent напрямую в контракте
    const intentId = await contract.create_swap_intent({
      from_token: params.fromToken,
      to_token: params.toToken,
      amount: amount.toString(),
      min_receive: calculateMinReceive(params.amount, params.fee).toString(),
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 час
    });

    return {
      success: true,
      intentId,
      message: 'Intent created on blockchain',
    };
  } catch (error: any) {
    console.error('Error creating swap intent:', error);
    return {
      success: false,
      error: error.message || 'Failed to create swap intent',
    };
  }
}
```

**ETA:** 1 неделя  
**Требования:** Знание NEAR SDK, Rust (для понимания контракта)

---

### 2.2 API Endpoints Implementation

**Задача:** Создать Next.js API routes для backend логики

#### 2.2.1 Swap Intent Endpoint
```typescript
// src/app/api/near-intents/swap/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initNearIntents } from '@/lib/near-intents-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromToken, toToken, amount, dexFee, userAccount } = body;

    // Валидация
    if (!fromToken || !toToken || !amount || !userAccount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Инициализируем контракт
    const contract = await initNearIntents('testnet');

    // Создаем intent
    const intentId = await contract.create_swap_intent({
      from_token: fromToken,
      to_token: toToken,
      amount: (amount * 1e24).toString(),
      min_receive: (amount * (1 - dexFee) * 1e24).toString(),
      deadline: Math.floor(Date.now() / 1000) + 3600,
    });

    // Возвращаем transaction data
    return NextResponse.json({
      success: true,
      intentId,
      transactionData: {
        receiverId: 'intents.near',
        methodName: 'create_swap_intent',
        args: { /* ... */ },
        gas: '300000000000000', // 300 TGas
        attachedDeposit: '1', // 1 yoctoNEAR
      },
      feeInfo: {
        percent: dexFee * 100,
        amount: (amount * dexFee).toString(),
        recipient: '1otc-dex.near',
      },
    });
  } catch (error: any) {
    console.error('Swap intent API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2.2.2 Bridge Intent Endpoint
```typescript
// src/app/api/near-intents/bridge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initNearIntents } from '@/lib/near-intents-sdk';
import { initRainbowBridge } from '@/lib/rainbow-bridge'; // Для cross-chain

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromChain, toChain, amount, dexFee, userAccount } = body;

    // Валидация
    if (!fromChain || !toChain || !amount || !userAccount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Определяем метод bridge based on chains
    let bridgeMethod: 'rainbow' | 'wormhole' | 'layerzero';
    
    if (fromChain === 'NEAR' && toChain === 'AURORA') {
      bridgeMethod = 'rainbow';
    } else if (fromChain === 'NEAR' && toChain === 'ETHEREUM') {
      bridgeMethod = 'rainbow';
    } else {
      bridgeMethod = 'wormhole'; // Fallback для других chains
    }

    // Создаем bridge intent
    const intentId = await createBridgeIntentOnChain({
      fromChain,
      toChain,
      amount,
      bridgeMethod,
      userAccount,
    });

    return NextResponse.json({
      success: true,
      intentId,
      bridgeMethod,
      estimatedTime: getBridgeEstimatedTime(fromChain, toChain),
      transactionData: { /* ... */ },
      feeInfo: {
        percent: dexFee * 100,
        amount: (amount * dexFee).toString(),
        recipient: '1otc-bridge.near',
      },
    });
  } catch (error: any) {
    console.error('Bridge intent API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2.2.3 Intent Status Endpoint
```typescript
// src/app/api/near-intents/status/[intentId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initNearIntents } from '@/lib/near-intents-sdk';

export async function GET(
  request: NextRequest,
  { params }: { params: { intentId: string } }
) {
  try {
    const { intentId } = params;

    if (!intentId) {
      return NextResponse.json(
        { error: 'Intent ID required' },
        { status: 400 }
      );
    }

    // Получаем статус из контракта
    const contract = await initNearIntents('testnet');
    const status = await contract.get_intent_status({ intent_id: intentId });

    return NextResponse.json({
      status: status.status,
      transactionHash: status.transaction_hash,
      filledAt: status.filled_at,
      expiryAt: status.expiry_at,
      solver: status.solver,
    });
  } catch (error: any) {
    console.error('Intent status API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
```

**ETA:** 3-4 дня  
**Требования:** Next.js API routes, NEAR SDK

---

### 2.3 Solver System (Advanced)

**Задача:** Создать систему solvers для исполнения интентов

**Это advanced feature, но критична для production:**

#### 2.3.1 Solver Node Setup
```bash
# Создаем отдельный solver service
mkdir -p services/solver-node
cd services/solver-node

# Инициализируем
pnpm init
pnpm add near-api-js axios dotenv

# Структура:
# services/solver-node/
#   ├── src/
#   │   ├── index.ts          # Main solver loop
#   │   ├── intent-monitor.ts # Мониторинг новых интентов
#   │   ├── price-oracle.ts   # Получение цен
#   │   ├── executor.ts       # Исполнение интентов
#   │   └── profitability.ts  # Расчет прибыльности
#   ├── package.json
#   └── .env
```

#### 2.3.2 Intent Monitor
```typescript
// services/solver-node/src/intent-monitor.ts

import { initNearIntents } from './near-sdk-init';

export class IntentMonitor {
  private contract: any;
  private lastBlock: number = 0;

  async start() {
    this.contract = await initNearIntents('testnet');
    
    // Poll every 2 seconds для новых интентов
    setInterval(() => this.checkNewIntents(), 2000);
  }

  async checkNewIntents() {
    try {
      // Получаем все pending интенты
      const intents = await this.contract.get_pending_intents({
        from_block: this.lastBlock,
      });

      for (const intent of intents) {
        // Проверяем прибыльность
        const isProfitable = await this.checkProfitability(intent);
        
        if (isProfitable) {
          // Исполняем intent
          await this.executeIntent(intent);
        }
      }

      this.lastBlock = await this.contract.get_latest_block();
    } catch (error) {
      console.error('Error checking intents:', error);
    }
  }

  async checkProfitability(intent: any): Promise<boolean> {
    // Получаем цены с DEX
    const priceOnRef = await this.getPriceFromRef(intent.from_token, intent.to_token);
    
    // Расчитываем potential profit
    const intentPrice = intent.min_receive / intent.amount;
    const profit = (priceOnRef - intentPrice) * intent.amount;
    
    // Вычитаем gas costs
    const gasCost = 0.01; // Примерно 0.01 NEAR на gas
    const netProfit = profit - gasCost;
    
    return netProfit > 0;
  }

  async executeIntent(intent: any) {
    // Исполняем intent через DEX
    // Подробности в executor.ts
  }
}
```

**ETA:** 1-2 недели  
**Требования:** DevOps знания, NEAR SDK, понимание DEX интеграций

---

### 2.4 Price Oracle Integration

**Задача:** Интеграция real-time price feeds

#### 2.4.1 Pyth Network Integration
```typescript
// src/lib/price-oracle/pyth-oracle.ts

import { PythHttpClient } from '@pythnetwork/pyth-evm-js';

const PYTH_ENDPOINT = 'https://hermes.pyth.network';

export async function getPythPrice(
  symbol: string
): Promise<{ price: number; confidence: number; timestamp: number }> {
  const client = new PythHttpClient(PYTH_ENDPOINT);
  
  // Pyth price feed IDs
  const PRICE_IDS: Record<string, string> = {
    'NEAR': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
    'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    'USDT': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  };

  const priceId = PRICE_IDS[symbol];
  if (!priceId) {
    throw new Error(`Price feed not found for ${symbol}`);
  }

  const priceData = await client.getLatestPriceFeeds([priceId]);
  const price = priceData[0];

  return {
    price: price.getPriceNoOlderThan(60).price, // Price not older than 60 seconds
    confidence: price.getConfidenceInterval(),
    timestamp: price.getPublishTime(),
  };
}
```

#### 2.4.2 REF Finance Integration
```typescript
// src/lib/price-oracle/ref-finance.ts

export async function getRefPrice(
  tokenIn: string,
  tokenOut: string,
  amount: number
): Promise<{ estimatedOut: number; priceImpact: number }> {
  const response = await fetch(
    `https://indexer.ref-finance.near.org/get-quote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenIn,
        tokenOut,
        amountIn: amount.toString(),
      }),
    }
  );

  const data = await response.json();
  
  return {
    estimatedOut: parseFloat(data.estimatedOut),
    priceImpact: data.priceImpact,
  };
}
```

**ETA:** 3-5 дней  
**Требования:** Понимание price oracles, API интеграций

---

### 2.5 Testing & Deployment

#### 2.5.1 Unit Tests
```typescript
// __tests__/near-intents.test.ts

import { createSwapIntent } from '@/lib/near-intents';

describe('NEAR Intents', () => {
  it('should create swap intent', async () => {
    const result = await createSwapIntent({
      fromToken: 'NEAR',
      toToken: 'USDT',
      amount: 10,
      fee: 0.003,
      userAccount: 'test.testnet',
    });

    expect(result.success).toBe(true);
    expect(result.intentId).toBeDefined();
  });
});
```

#### 2.5.2 Integration Tests
```bash
# Тестируем на NEAR testnet
pnpm test:integration

# Проверяем создание интентов
# Проверяем получение статуса
# Проверяем исполнение через solver
```

#### 2.5.3 Deployment
```bash
# Deploy solver node на VPS
ssh user@solver.1otc.cc
cd /opt/solver-node
pm2 start dist/index.js --name "1otc-solver"

# Deploy smart contracts (if needed custom)
near deploy --accountId intents.1otc.testnet --wasmFile out/intents.wasm
```

**ETA:** 3-4 дня  
**Требования:** Testing frameworks, DevOps

---

## ⏳ ФАЗА 3: Advanced DEX Features

**Статус:** ЗАПЛАНИРОВАНА  
**Оценка времени:** 4-6 недель  
**Приоритет:** 🟡 MEDIUM

### 3.1 Limit Orders
### 3.2 Stop Loss / Take Profit
### 3.3 Batch Swaps
### 3.4 Routing Optimization
### 3.5 Slippage Protection Advanced
### 3.6 MEV Protection

**Детальные планы в:** `NEAR_INTENTS_CAPABILITIES.md` (секции TIER 2)

---

## ⏳ ФАЗА 4: Professional UI/UX

**Статус:** ЗАПЛАНИРОВАНА  
**Оценка времени:** 3-4 недели  
**Приоритет:** 🟢 LOW (но важно для production)

### 4.1 TradingView Charts Integration
### 4.2 Order Book Visualization
### 4.3 Advanced Analytics Dashboard
### 4.4 Portfolio Tracker

**Детальные планы в:** `NEAR_INTENTS_CAPABILITIES.md` (секции TIER 4)

---

## 📋 Summary Timeline

| Фаза | Задачи | Время | Статус |
|------|--------|-------|--------|
| **Фаза 1** | Дизайн аудит + исправления | 1 день | ✅ ЗАВЕРШЕНО |
| **Фаза 2** | NEAR Intents интеграция | 2-3 недели | 🔄 ГОТОВО К СТАРТУ |
| **Фаза 3** | Advanced DEX features | 4-6 недель | ⏳ ЗАПЛАНИРОВАНО |
| **Фаза 4** | Professional UI/UX | 3-4 недели | ⏳ ЗАПЛАНИРОВАНО |
| **ИТОГО** | | **~10-14 недель** | **25% завершено** |

---

## 🎯 Immediate Next Steps

1. **This Week:**
   - Изучить NEAR Intents smart contract
   - Создать NEAR SDK wrapper
   - Начать реализацию API endpoints

2. **Next Week:**
   - Завершить API endpoints
   - Начать solver system basic version
   - Интегрировать Pyth price oracle

3. **Week 3-4:**
   - Полная интеграция solver system
   - Testing на testnet
   - Deploy solver node

4. **Month 2-3:**
   - Начать Фазу 3 (Advanced Features)
   - Limit Orders implementation
   - Stop Loss / Take Profit

---

## 📚 Resources

**NEAR Intents:**
- GitHub: https://github.com/near/intents
- Docs: https://docs.near.org/concepts/intents
- SDK: https://docs.near.org/tools/near-api-js

**Price Oracles:**
- Pyth Network: https://pyth.network/
- REF Finance API: https://guide.ref.finance/developers-1/api

**Solvers:**
- CoW Protocol (reference): https://docs.cow.fi/
- 1inch Fusion (reference): https://docs.1inch.io/docs/fusion-swap/introduction

---

**Status:** ✅ Phase 1 completed, Phase 2 ready to start  
**Next Action:** Begin NEAR Intents smart contract integration  
**Owner:** 1OTC DEX Team  
**Last Updated:** November 2, 2025

