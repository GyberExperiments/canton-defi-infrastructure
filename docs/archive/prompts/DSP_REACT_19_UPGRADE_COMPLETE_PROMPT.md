# 🚀 Промпт: Обновление DSP до React 19.2.1 и исправление framer-motion

## 📋 Контекст проекта

**Проект**: DSP (Decentralized Social Platform)  
**Расположение**: `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP`  
**Текущая директория**: `/Users/Gyber/GYBERNATY-ECOSYSTEM/canton-otc`

**Текущее состояние package.json DSP:**
```json
{
  "react": "^19.2.1",
  "react-dom": "^19.2.1",
  "@types/react": "^19.2.0",
  "@types/react-dom": "^19.2.0",
  "framer-motion": "^12.23.24",
  "next": "^15.5.7"
}
```

## ✅ Что уже сделано

1. **Исправлены все уязвимости CVE-2025-55182:**
   - canton-otc: React 19.2.1, Next.js 15.5.7 ✅
   - maximus: React 19.2.1, Next.js 15.5.7 ✅
   - DSP: Next.js 15.5.7 ✅, React обновлён до 19.2.1 в package.json ✅

2. **Исправлена конфигурация wagmi для SSR:**
   - `src/shared/config/web3.ts` - использует cookie storage
   - `src/app/layout.tsx` - async функция с cookieToInitialState
   - `src/app/providers/Web3Provider.tsx` - принимает initialState

3. **Исправлены ошибки TypeScript:**
   - logger.ts - исправлены вызовы
   - useUnitProfile.ts - исправлены wagmi хуки
   - serviceWorker.ts - исправлены типы

4. **Обновлён framer-motion:**
   - С 10.16.1 → 12.23.24 (совместим с React 19)

5. **Все образы собраны и задеплоены:**
   - canton-otc:main, stage, minimal-stage
   - maximus:main
   - dsp-prod:latest (но с ошибками сборки)

## 🔴 Текущие проблемы

### 1. Ошибки TypeScript с framer-motion 12.x + React 19

**Проблема**: В framer-motion 12.x для React 19 компоненты `motion` требуют явного указания HTML элемента.

**Ошибки типа:**
```
Property 'className' does not exist on type 'IntrinsicAttributes & HTMLAttributesWithoutMotionProps<unknown, unknown> & MotionProps & RefAttributes<unknown>'
```

**Файлы с ошибками** (из type-check):
- `src/entities/CardMember/ui/CardMember.tsx` (строка 24)
- `src/entities/CardMember/ui/CardMemberEvolution.tsx` (строка 26)
- `src/entities/Roadmap/ui/RoadmapCard/RoadmapCard.tsx` (строки 53, 112, 140)
- `src/entities/TechnicalRoadmap/ui/card/Card.tsx` (строка 45)
- `src/features/UnitProfile/ui/UnitProfileEditor/UnitProfileEditor.tsx` (строка 152)
- `src/features/UnitProfile/ui/UnitProfileView/UnitProfileView.tsx` (строки 89, 157, 169, 181, 193, 214)
- `src/shared/ui/AnimatedIcon/AnimatedIcon.tsx` (строка 39)
- `src/shared/ui/Button/Button-Enhanced.tsx` (строка 45)
- `src/shared/ui/Button/Button-Evolution.tsx` (строки 125, 147, 168, 178, 182, 193, 202)
- `src/shared/ui/DynamicLighting/DynamicLighting.tsx` (строки 86, 107)
- `src/shared/ui/InteractiveCard/InteractiveCard.tsx` (строки 203, 235, 260)
- `src/shared/ui/OptimizedImage/OptimizedImage.tsx` (строки 134, 146, 215)
- `src/shared/ui/ParticleSystem/ParticleSystem.tsx` (строки 50, 221, 234, 247)
- `src/shared/ui/Toast/Toast.tsx` (строка 60)
- `src/widgets/Documents/ui/Documents.tsx` (строки 57, 84)

### 2. Проблема Dockerfile

**Ошибка**: Next.js пытается использовать pnpm, но его нет в builder stage
```
/bin/sh: pnpm: not found
```

**Текущий Dockerfile:**
```dockerfile
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build
```

**Решение**: Добавить установку pnpm в builder stage через corepack

## 🎯 Задача

**Обновить DSP до React 19.2.1 и исправить все компоненты framer-motion**

### План действий:

1. **Исправить Dockerfile:**
   - Добавить `RUN corepack enable && corepack prepare pnpm@latest --activate` в builder stage
   - Исправить формат ENV (использовать `ENV KEY=value` вместо `ENV KEY value`)

2. **Исправить все компоненты framer-motion:**
   - Найти все использования `<motion` без указания элемента
   - Заменить на правильные компоненты:
     - `<motion.div>` для div элементов
     - `<motion.button>` для button элементов
     - `<motion.span>` для span элементов
     - `<motion.section>` для section элементов
     - `<motion.header>` для header элементов
     - И т.д. в зависимости от контекста

3. **Проверить type-check:**
   - После каждого изменения запускать `npm run type-check`
   - Убедиться, что все ошибки исправлены

4. **Пересобрать образ:**
   - `docker build --platform linux/amd64 -t ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest .`
   - Запушить: `docker push ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest`

5. **Обновить deployments:**
   - `kubectl set image deployment/dsp-prod-deployment dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`
   - `kubectl set image deployment/dsp-prod-deployment-primary dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`
   - `kubectl set image deployment/auradomus-deployment auradomus=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`

## 📝 Примеры исправлений

### Пример 1: CardMember.tsx

**Было:**
```tsx
<motion 
  className={classNames(cls.CardMember, {}, [className])}
  initial={{scale: 0.8}}
  whileInView={{scale: 1, transition: { type: "spring", bounce: 0.2, duration: .8}}}
  viewport={{ once: true, amount: 0.5 }}
>
```

**Должно быть:**
```tsx
<motion.div 
  className={classNames(cls.CardMember, {}, [className])}
  initial={{scale: 0.8}}
  whileInView={{scale: 1, transition: { type: "spring", bounce: 0.2, duration: .8}}}
  viewport={{ once: true, amount: 0.5 }}
>
```

### Пример 2: Button-Evolution.tsx

**Уже правильно** (используется `motion.button`):
```tsx
<motion.button
  className={classNames(...)}
  variants={buttonVariants}
  ...
>
```

### Пример 3: OptimizedImage.tsx

**Было:**
```tsx
<motion
  className={...}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
```

**Должно быть:**
```tsx
<motion.div
  className={...}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
```

## 🔍 Как найти все проблемные места

**Команда для поиска:**
```bash
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/DSP
grep -r "<motion[^.]" src/ --include="*.tsx" --include="*.ts"
```

**Паттерн для поиска:**
- `<motion ` (без точки после motion)
- `<motion>` (без указания элемента)

**Правильные паттерны:**
- `<motion.div>` ✅
- `<motion.button>` ✅
- `<motion.span>` ✅
- `<motion.section>` ✅

## 📁 Структура проекта DSP

```
DSP/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (async, использует cookieToInitialState)
│   │   ├── providers/          # Провайдеры
│   │   │   └── Web3Provider.tsx # Wagmi провайдер (SSR-совместимый)
│   │   └── ...
│   ├── entities/               # Бизнес-сущности
│   │   ├── CardMember/
│   │   ├── Roadmap/
│   │   └── TechnicalRoadmap/
│   ├── features/               # Фичи приложения
│   │   └── UnitProfile/
│   ├── shared/                 # Общие компоненты
│   │   ├── ui/                 # UI компоненты (много framer-motion)
│   │   ├── hooks/              # React хуки
│   │   ├── lib/                # Утилиты
│   │   └── config/             # Конфигурация
│   │       └── web3.ts         # Wagmi config (cookie storage)
│   └── widgets/                # Виджеты
├── public/                     # Статические файлы
├── Dockerfile                   # Docker конфигурация
├── package.json                 # Зависимости (React 19.2.1, framer-motion 12.23.24)
├── pnpm-lock.yaml              # Lockfile для pnpm
└── next.config.js              # Next.js конфигурация (output: standalone)
```

## ⚙️ Важные конфигурации

### next.config.js:
```javascript
{
  output: "standalone",
  experimental: {
    webpackBuildWorker: false,
  },
  // ... остальная конфигурация
}
```

### web3.ts (wagmi config):
```typescript
export function getConfig(): Config {
  if (typeof window === 'undefined') {
    return { chains: [...] } as any; // Для SSR
  }
  // ... создание конфигурации с cookie storage
}
```

## 🛠️ Технические детали

### framer-motion 12.x + React 19:

В framer-motion 12.x для React 19:
- ❌ `motion` - не работает (нужен конкретный элемент)
- ✅ `motion.div` - работает
- ✅ `motion.button` - работает
- ✅ `motion.span` - работает
- ✅ Все HTML элементы доступны через `motion.*`

### Dockerfile исправления:

**Добавить в builder stage:**
```dockerfile
FROM base AS builder
WORKDIR /app
# Enable corepack for pnpm support
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build
```

**Исправить ENV формат:**
```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
```

## 📊 Статус Kubernetes

**Текущие deployments:**
- `dsp-prod-deployment` в namespace `default`
- `dsp-prod-deployment-primary` в namespace `default`
- `auradomus-deployment` в namespace `default`

**IP сервера**: 45.9.41.209  
**Kubernetes API**: https://31.129.105.180:6443

## ✅ Критерии успеха

1. ✅ `npm run type-check` проходит без ошибок
2. ✅ Docker образ собирается успешно
3. ✅ Образ запушен в registry
4. ✅ Deployments обновлены и работают
5. ✅ Все проекты используют React 19.2.1 (консистентность)

## 🚨 Важные правила

1. **Всегда читай файлы перед изменением**
2. **Проверяй type-check после каждого изменения**
3. **Делай всё в основном потоке с полным логированием**
4. **Не ломай существующий функционал**
5. **Учитывай директории проектов** - DSP в `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP`

## 📝 Команды для выполнения

```bash
# 1. Перейти в директорию DSP
cd /Users/Gyber/GYBERNATY-ECOSYSTEM/DSP

# 2. Проверить type-check
npm run type-check

# 3. После исправлений - пересобрать образ
docker build --platform linux/amd64 -t ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest .

# 4. Запушить образ
docker push ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest

# 5. Обновить deployments
kubectl set image deployment/dsp-prod-deployment dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default
kubectl set image deployment/dsp-prod-deployment-primary dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default
kubectl set image deployment/auradomus-deployment auradomus=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default
```

---

**НАЧНИ С ИСПРАВЛЕНИЯ DOCKERFILE, ЗАТЕМ ИСПРАВЛЯЙ КОМПОНЕНТЫ FRAMER-MOTION ПО ОДНОМУ, ПРОВЕРЯЯ TYPE-CHECK ПОСЛЕ КАЖДОГО ИЗМЕНЕНИЯ.**

**ВАЖНО: Все команды выполнять в основном потоке с полным логированием, чтобы видеть весь процесс в реальном времени.**


