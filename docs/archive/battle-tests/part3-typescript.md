# CANTON OTC BATTLE TEST - PART 3/5: ФИКС TYPESCRIPT

> Предыдущий: PART-2 (BATTLE_TEST_PART2_RUST_API_FIX.md)
> Следующий: PART-4 (BATTLE_TEST_PART4_LOCAL_SANDBOX.md)

## ЗАДАЧА

Починить сломанные TypeScript файлы:
1. `/api/daml/health/route.ts` — несуществующий импорт damlService
2. `damlIntegrationService.ts` — добавить getStatus() и singleton export
3. `create-order/route.ts` — обновить запрос к Rust API под новый формат

---

## ШАГ 1: Починить damlIntegrationService.ts — добавить getStatus() и singleton

### Файл: `src/lib/canton/services/damlIntegrationService.ts`

### Проблема:
- Нет метода `getStatus()` который вызывает health endpoint
- Нет exported singleton `damlService`
- Есть `isMock: boolean` но нет способа узнать статус извне

### Что добавить В КОНЕЦ файла (после определения класса):

```typescript
// === Метод getStatus() — добавить ВНУТРИ класса DamlIntegrationService ===

public getStatus(): { mode: string; contractCount: number; cacheSize: number } {
  return {
    mode: this.isMock ? 'MOCK' : 'REAL',
    contractCount:
      this.assetContracts.size +
      this.holdingContracts.size +
      this.purchaseRequests.size,
    cacheSize:
      this.assetContracts.size +
      this.holdingContracts.size +
      this.purchaseRequests.size,
  };
}
```

### Singleton export — добавить В КОНЕЦ файла (ПОСЛЕ класса):

```typescript
// === Singleton для серверного использования (API routes) ===
import { getCantonParticipantConfig } from '@/lib/canton/config/cantonEnv';

let _damlServiceInstance: DamlIntegrationService | null = null;

export function getDamlService(): DamlIntegrationService {
  if (!_damlServiceInstance) {
    const config = getCantonParticipantConfig();
    _damlServiceInstance = new DamlIntegrationService({
      participantUrl: config.participantUrl,
      participantId: config.participantId,
      authToken: config.authToken,
      partyId: config.partyId,
    });
  }
  return _damlServiceInstance;
}

// Legacy alias для обратной совместимости
export const damlService = {
  getStatus: () => getDamlService().getStatus(),
};
```

---

## ШАГ 2: Починить /api/daml/health/route.ts

### Файл: `src/app/api/daml/health/route.ts`

### ТЕКУЩИЙ КОД (СЛОМАН):
```typescript
import { damlService } from '@/lib/canton/services/damlIntegrationService';
// ^^^ ОШИБКА: damlService не экспортируется!
```

### НОВЫЙ КОД:
```typescript
import { getDamlService } from '@/lib/canton/services/damlIntegrationService';
import { NextResponse } from 'next/server';

/**
 * GET /api/daml/health
 * Health check endpoint for DAML Canton Network connection
 */
export async function GET() {
  try {
    const service = getDamlService();
    const status = service.getStatus();

    return NextResponse.json({
      mode: status.mode,
      connected: status.mode === 'REAL',
      ledgerHost: process.env.CANTON_PARTICIPANT_URL || process.env.DAML_LEDGER_HOST || 'not-configured',
      ledgerPort: process.env.CANTON_LEDGER_PORT || process.env.DAML_LEDGER_PORT || 'not-configured',
      applicationId: process.env.CANTON_APPLICATION_ID || 'canton-otc-platform',
      contractCount: status.contractCount,
      cacheSize: status.cacheSize,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        mode: 'ERROR',
        connected: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

---

## ШАГ 3: Обновить create-order/route.ts — новый формат запроса к Rust API

### Файл: `src/app/api/create-order/route.ts`

### Проблема:
Текущий код отправляет плоский JSON в Rust API:
```typescript
const damlPayload = {
  order_id: orderId,
  initiator: cantonAddress,
  asset: normalizedToken,
  quantity: parseFloat(amount),
  price: rate,
  offer_type: type,
  created_at: new Date().toISOString(),
};
```

### НОВЫЙ формат (соответствует новому Rust API из PART-2):

Найти блок где формируется `damlPayload` и заменить на:

```typescript
// Формирование payload для Rust Canton API (соответствует DAML OtcOffer template)
const damlPayload = {
  offer_id: orderId,
  initiator: cantonAddress,
  counterparty: null,  // public offer
  asset: {
    symbol: normalizedToken,
    amount: amount.toString(),
    chain: 'Canton',
    contract_address: null,
  },
  price: {
    rate: rate.toString(),
    currency: 'USD',
  },
  quantity: amount.toString(),
  side: type === 'buy' ? 'buy' : 'sell',
  limits: {
    min_amount: (parseFloat(process.env.MIN_USDT_AMOUNT || '100')).toString(),
    max_amount: amount.toString(),
  },
  min_compliance_level: 'basic',
  allowed_jurisdictions: ['US', 'EU', 'UK', 'CH', 'SG', 'HK'],
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),  // +7 дней
};
```

### ВАЖНО: Найти точное место в файле

Поиск: `const damlPayload` или `order_id:` или `CANTON_API_SERVER_URL`

Блок обычно выглядит так:
```typescript
// Try to create DAML contract via Canton API
const cantonApiUrl = process.env.CANTON_API_SERVER_URL;
if (cantonApiUrl) {
  try {
    const damlPayload = { ... };
    const damlResponse = await fetch(`${cantonApiUrl}/api/v1/contracts/offer`, {
```

Заменить ТОЛЬКО объект `damlPayload`, не трогая `fetch()` логику.

---

## ШАГ 4: Убедиться что cantonEnv.ts корректен

### Файл: `src/lib/canton/config/cantonEnv.ts`

Этот файл УЖЕ правильный, проверить что он существует:

```typescript
export function getCantonParticipantConfig(): CantonParticipantConfig {
  return {
    participantUrl: process.env.CANTON_PARTICIPANT_URL ?? 'http://65.108.15.30:30757',
    participantId: process.env.CANTON_PARTICIPANT_ID ?? 'participant1',
    partyId: process.env.CANTON_PARTY_ID ?? 'wealth_management_party',
    authToken: process.env.CANTON_AUTH_TOKEN ?? '',
  };
}
```

Для локального тестирования env переменные будут:
```
CANTON_PARTICIPANT_URL=http://localhost:5011
CANTON_PARTICIPANT_ID=participant1
CANTON_PARTY_ID=otc_operator
CANTON_API_SERVER_URL=http://localhost:8080
```

---

## ПРОВЕРКА

После всех изменений:

1. `GET /api/daml/health` — должен возвращать JSON со статусом (MOCK или REAL)
2. `POST /api/create-order` — должен отправлять полный payload в Rust API
3. Нет TS compilation errors: `npx tsc --noEmit` должен проходить без ошибок на изменённых файлах

---

## ПЕРЕХОДИ К PART-4 после завершения всех шагов этого документа.
