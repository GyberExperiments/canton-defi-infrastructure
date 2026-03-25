# 🏗️ ConfigMap Architecture Update Report

## 📋 Background

Previously, all configuration values (prices, limits, etc.) were stored in GitHub Secrets and loaded into `process.env` at container startup. This meant:
- ❌ Values were static after deployment
- ❌ Required redeployment to change prices
- ❌ `process.env` not available on client-side

## 🎯 New Architecture

### Server-Side
- **Dynamic configs** (prices, limits) → Kubernetes ConfigMap
- **Secrets** (tokens, passwords) → GitHub Secrets
- ConfigManager reads from ConfigMap via Kubernetes API
- Fallback to `process.env` only for local development

### Client-Side
- Fetch configuration from `/api/config` endpoint
- Use `useConfig()` hook from ConfigProvider
- No direct `process.env` access

## ✅ Changes Made

### 1. Fixed `OTC_CONFIG` in `src/config/otc.ts`
```typescript
// Before: Threw errors on client
export const getCantonCoinSellPrice = (): number => {
  const price = process.env.CANTON_COIN_SELL_PRICE_USD;
  if (!price) {
    throw new Error('CANTON_COIN_SELL_PRICE_USD not configured');
  }
  return parseFloat(price);
};

// After: Returns fallback values
export const getCantonCoinSellPrice = (): number => {
  const price = process.env.CANTON_COIN_SELL_PRICE_USD;
  if (!price) {
    console.warn('CANTON_COIN_SELL_PRICE_USD not set, using fallback');
    return 0.19; // Fallback value
  }
  return parseFloat(price);
};
```

### 2. Fixed `MIN_CANTON_AMOUNT` 
```typescript
// Before: Dynamic getter that failed on client
get MIN_CANTON_AMOUNT() { 
  return Math.ceil(parseFloat(process.env.MIN_USDT_AMOUNT || '1') / getCantonCoinSellPrice()); 
}

// After: Static value for client compatibility
MIN_CANTON_AMOUNT: 5, // Static value to avoid client errors
```

### 3. Updated Components to Use ConfigManager
```typescript
// ExchangeFormCompact.tsx & ExchangeForm.tsx
import { useCantonPrices, useLimits } from './ConfigProvider'

const { minCantonAmount: configMinCantonAmount } = useLimits()
const minCantonAmount = configMinCantonAmount || 5
```

### 4. Fixed Division by Zero in API
```typescript
// src/app/api/config/route.ts
minCantonAmount: Math.ceil(
  parseFloat(configMapData.MIN_USDT_AMOUNT || '1') / 
  parseFloat(configMapData.CANTON_COIN_SELL_PRICE_USD || '0.19') // Fallback to prevent division by zero
),
```

### 5. Added Validation in ConfigManager
```typescript
// src/lib/config-manager.ts
minCantonAmount: cantonCoinSellPrice > 0 ? 
  Math.ceil(parseFloat(configMapData.MIN_USDT_AMOUNT || '1') / cantonCoinSellPrice) : 
  5, // Fallback when price is 0
```

## 🔄 Configuration Flow

1. **Admin updates price** → `/api/admin/settings`
2. **API updates ConfigMap** → Kubernetes ConfigMap
3. **ConfigManager refreshes** → Every 30 seconds
4. **Client fetches** → `/api/config` endpoint
5. **Components re-render** → Using `useConfig()` hook

## 📝 Best Practices

### DO ✅
- Use `useConfig()` hook in components
- Use ConfigManager on server-side
- Add fallback values for all calculations
- Validate division operations

### DON'T ❌
- Access `process.env` directly for dynamic configs
- Use `OTC_CONFIG` for dynamic values on client
- Assume prices are always > 0
- Throw errors in client-side code

## 🚀 Testing

```bash
# Check if ConfigMap is working
kubectl get configmap canton-otc-config -n canton-otc-minimal-stage -o yaml

# Check logs for config updates
kubectl logs -f deployment/canton-otc -n canton-otc-minimal-stage | grep "Configuration refreshed"

# Test price update
# 1. Go to /admin/settings
# 2. Change price
# 3. Save
# 4. Check if it persists after 30 seconds
```

## 🔧 Troubleshooting

### Error: "CANTON_COIN_SELL_PRICE_USD not configured"
- Client is trying to access `process.env`
- Use `useConfig()` instead

### Error: Division by zero
- Price is 0 in ConfigMap
- Check fallback values are set

### Values revert after 30 seconds
- ConfigMap not updating properly
- Check Kubernetes RBAC permissions
- Check admin API logs
