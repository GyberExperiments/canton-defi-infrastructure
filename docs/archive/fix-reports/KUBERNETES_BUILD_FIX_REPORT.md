# 🔧 Отчет: Исправление ошибки сборки с @kubernetes/client-node

## ❌ Проблема

При деплое в GitHub Actions получали ошибку:

```
Module build failed: UnhandledSchemeError: Reading from "node:http" is not handled by plugins
Reading from "node:https" is not handled by plugins

Import trace:
node:https
@kubernetes/client-node/dist/config.js
@kubernetes/client-node/dist/index.js
./src/lib/kubernetes-config.ts
./src/lib/config-manager.ts
./src/hooks/useConfig.ts
./src/components/ConfigProvider.tsx
```

**Причина:**  
Next.js пытался включить `@kubernetes/client-node` в клиентский бандл (для браузера), но эта библиотека использует Node.js модули (`node:http`, `node:https`), которые недоступны в браузере.

## ✅ Решение

### 1. Убрали статические импорты

**До:**
```typescript
// ❌ Статический импорт попадал в клиентский бандл
import { getKubernetesConfigManager } from '@/lib/kubernetes-config';
```

**После:**
```typescript
// ✅ Динамический импорт только на сервере
const { getKubernetesConfigManager } = await import('@/lib/kubernetes-config');
```

### 2. Обновили Next.js конфигурацию

**`next.config.js`:**

```javascript
{
  // ✅ Исключаем из серверного бандла
  serverExternalPackages: ['tronweb', 'bip32', 'tiny-secp256k1', '@kubernetes/client-node'],
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // ✅ Исключаем из клиентского бандла
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@kubernetes/client-node': false,
      };
      
      config.externals = config.externals || [];
      config.externals.push({
        '@kubernetes/client-node': 'commonjs @kubernetes/client-node',
      });
    }
    return config;
  }
}
```

### 3. Изменённые файлы

1. **`src/app/api/config/route.ts`**
   - Заменили статический импорт на динамический

2. **`src/app/api/admin/settings/route.ts`**
   - Заменили статический импорт на динамический

3. **`next.config.js`**
   - Добавили `@kubernetes/client-node` в `serverExternalPackages`
   - Добавили fallback для клиентского кода
   - Добавили в externals

## 🎯 Как это работает

### Архитектура

```
┌─────────────────────────────────────────────────┐
│                  Browser (Client)                │
│                                                  │
│  ConfigProvider → useConfig()                   │
│         ↓                                        │
│  fetch('/api/config') ✅ (через API)            │
└─────────────────────────────────────────────────┘
                     ↓ HTTP Request
┌─────────────────────────────────────────────────┐
│              Server (Next.js API)                │
│                                                  │
│  /api/config → await import('@/lib/kubernetes')  │
│         ↓                                        │
│  KubernetesConfigManager → ConfigMap ✅          │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│          Kubernetes ConfigMap                    │
│                                                  │
│  CANTON_COIN_BUY_PRICE_USD: "55"                │
│  CANTON_COIN_SELL_PRICE_USD: "25"               │
└─────────────────────────────────────────────────┘
```

### Почему это работает:

1. **Клиент (браузер):**
   - НЕ импортирует `@kubernetes/client-node` напрямую
   - Использует только `fetch('/api/config')`
   - Работает через HTTP API

2. **Сервер (API Routes):**
   - Использует динамический `await import()` только когда нужно
   - `@kubernetes/client-node` загружается только на сервере
   - Никогда не попадает в клиентский бандл

3. **Webpack:**
   - Видит `fallback: { '@kubernetes/client-node': false }`
   - Исключает библиотеку из клиентской сборки
   - Не пытается обработать `node:http` / `node:https`

## 📊 Проверка

### 1. Проверить что сборка проходит

```bash
pnpm build
```

**Ожидается:** ✅ Build completed successfully

### 2. Проверить размер бандлов

```bash
ls -lh .next/static/chunks/
```

**Ожидается:** НЕТ файлов с именем содержащим "kubernetes"

### 3. Проверить что API работает

После деплоя:
```bash
curl https://stage.minimal.build.infra.1otc.cc/api/config | jq '.cantonCoinBuyPrice'
```

**Ожидается:** Текущая цена из ConfigMap

## 🚀 Деплой

После этих изменений сборка должна пройти успешно:

```bash
# Локально
pnpm build   # ✅ Должно работать

# В GitHub Actions
git add .
git commit -m "fix: исправлена ошибка компиляции с @kubernetes/client-node"
git push origin minimal-stage
```

## 📝 Важные моменты

### ✅ Правильно

```typescript
// В API route или серверном компоненте
export async function GET() {
  const { getKubernetesConfigManager } = await import('@/lib/kubernetes-config');
  const manager = getKubernetesConfigManager();
  // ...
}
```

### ❌ Неправильно

```typescript
// В клиентском компоненте или файле который может быть импортирован клиентом
import { getKubernetesConfigManager } from '@/lib/kubernetes-config'; // ❌
```

### 🎯 Золотое правило

**Любой файл который импортируется в клиентских компонентах НЕ ДОЛЖЕН импортировать `@kubernetes/client-node`**

## 🔗 Связанные файлы

- `/src/app/api/config/route.ts` - ✅ Динамический импорт
- `/src/app/api/admin/settings/route.ts` - ✅ Динамический импорт
- `/src/lib/config-manager.ts` - ✅ Динамический импорт (на сервере)
- `/src/lib/kubernetes-config.ts` - ⚠️ Импортируется только динамически
- `/next.config.js` - ✅ Webpack конфигурация

---

**Автор:** AI Assistant  
**Дата:** 2025-10-23  
**Версия:** 1.0 (Build Fix)

