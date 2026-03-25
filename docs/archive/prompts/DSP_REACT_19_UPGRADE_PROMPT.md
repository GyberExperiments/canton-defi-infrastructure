# Промпт для обновления DSP до React 19.2.1 и исправления framer-motion

## 🎯 Контекст проекта

**Проект**: DSP (Decentralized Social Platform)  
**Расположение**: `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP`  
**Текущее состояние**: 
- Next.js: 15.5.7 ✅ (обновлён для исправления CVE-2025-55182)
- React: 18.2.0 → нужно обновить до 19.2.1
- react-dom: 18.2.0 → нужно обновить до 19.2.1
- framer-motion: 10.16.1 → обновлён до 12.23.24 (но есть ошибки TypeScript)
- @types/react: ^19.2.0 ✅
- @types/react-dom: ^19.2.0 ✅

## 📋 Что было сделано ранее

1. ✅ Исправлены все уязвимости CVE-2025-55182 в проектах:
   - canton-otc: React 19.2.1, Next.js 15.5.7
   - maximus: React 19.2.1, Next.js 15.5.7
   - DSP: Next.js 15.5.7 (React остался 18.2.0)

2. ✅ Все образы пересобраны и запушены в GitHub Container Registry:
   - ghcr.io/themacroeconomicdao/cantonotc:main (70f637f9368f)
   - ghcr.io/themacroeconomicdao/cantonotc:stage (70f637f9368f)
   - ghcr.io/themacroeconomicdao/cantonotc:minimal-stage (70f637f9368f)
   - ghcr.io/themacroeconomicdao/maximus:main (6e75118c4084)
   - ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest (09fc6e07835c)

3. ✅ Все deployments обновлены в Kubernetes и работают

4. ✅ Настроена SSR-совместимость для wagmi (cookie storage вместо indexedDB)

5. ✅ Исправлены ошибки TypeScript (logger, useUnitProfile, serviceWorker)

## 🔧 Текущая задача

**Обновить DSP до React 19.2.1 и исправить все компоненты framer-motion**

### Проблемы, которые нужно решить:

1. **Ошибки TypeScript с framer-motion 12.x и React 19:**
   - `Property 'className' does not exist on type 'IntrinsicAttributes & HTMLAttributesWithoutMotionProps<unknown, unknown> & MotionProps & RefAttributes<unknown>'`
   - Это происходит потому что в framer-motion 12.x для React 19 нужно использовать `motion.div`, `motion.button` и т.д. вместо просто `motion`

2. **Dockerfile проблемы:**
   - Next.js пытается использовать pnpm, но его нет в builder stage
   - Нужно либо установить pnpm в builder stage, либо использовать yarn/npm

3. **Файлы с ошибками framer-motion:**
   - `src/entities/CardMember/ui/CardMember.tsx`
   - `src/entities/CardMember/ui/CardMemberEvolution.tsx`
   - `src/entities/Roadmap/ui/RoadmapCard/RoadmapCard.tsx`
   - `src/entities/TechnicalRoadmap/ui/card/Card.tsx`
   - `src/features/UnitProfile/ui/UnitProfileEditor/UnitProfileEditor.tsx`
   - `src/features/UnitProfile/ui/UnitProfileView/UnitProfileView.tsx`
   - `src/shared/ui/AnimatedIcon/AnimatedIcon.tsx`
   - `src/shared/ui/Button/Button-Enhanced.tsx`
   - `src/shared/ui/Button/Button-Evolution.tsx`
   - `src/shared/ui/DynamicLighting/DynamicLighting.tsx`
   - `src/shared/ui/InteractiveCard/InteractiveCard.tsx`
   - `src/shared/ui/OptimizedImage/OptimizedImage.tsx`
   - `src/shared/ui/ParticleSystem/ParticleSystem.tsx`
   - `src/shared/ui/Toast/Toast.tsx`
   - `src/widgets/Documents/ui/Documents.tsx`
   - И другие файлы, использующие `motion` компоненты

## 📝 Технические детали

### Текущий package.json DSP:
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

### Проблема с framer-motion:

В framer-motion 12.x для React 19 нужно использовать конкретные компоненты:
- ❌ `<motion className="...">` - не работает
- ✅ `<motion.div className="...">` - правильно
- ✅ `<motion.button className="...">` - правильно
- ✅ `<motion.span className="...">` - правильно

### Dockerfile проблемы:

Текущий Dockerfile использует yarn для сборки, но Next.js пытается использовать pnpm из pnpm-lock.yaml. Нужно:
- Либо установить pnpm в builder stage
- Либо использовать yarn для всего (удалить pnpm-lock.yaml или игнорировать его)

## 🎯 Задачи

1. **Исправить все компоненты framer-motion:**
   - Найти все использования `<motion` без указания элемента
   - Заменить на `<motion.div>`, `<motion.button>`, `<motion.span>` и т.д. в зависимости от контекста
   - Проверить все файлы из списка ошибок TypeScript

2. **Исправить Dockerfile:**
   - Добавить установку pnpm в builder stage через `corepack enable && corepack prepare pnpm@latest --activate`
   - Или переключиться на yarn для всего процесса

3. **Проверить type-check:**
   - Убедиться, что `npm run type-check` проходит без ошибок

4. **Пересобрать образ:**
   - `docker build --platform linux/amd64 -t ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest .`
   - Запушить в registry: `docker push ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest`

5. **Обновить deployment:**
   - `kubectl set image deployment/dsp-prod-deployment dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`
   - `kubectl set image deployment/dsp-prod-deployment-primary dsp-prod=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`
   - `kubectl set image deployment/auradomus-deployment auradomus=ghcr.io/themacroeconomicdao/decentralized-social-platform/dsp-prod:latest -n default`

## 📁 Структура проекта DSP

```
DSP/
├── src/
│   ├── app/                    # Next.js App Router
│   ├── entities/               # Бизнес-сущности
│   ├── features/               # Фичи приложения
│   ├── shared/                 # Общие компоненты и утилиты
│   │   ├── ui/                 # UI компоненты (много framer-motion)
│   │   ├── hooks/              # React хуки
│   │   ├── lib/                # Утилиты
│   │   └── config/             # Конфигурация (web3.ts)
│   └── widgets/                # Виджеты
├── public/                     # Статические файлы
├── Dockerfile                   # Docker конфигурация
├── package.json                 # Зависимости
└── pnpm-lock.yaml              # Lockfile для pnpm
```

## 🔍 Важные файлы

### Конфигурация wagmi (уже исправлена):
- `src/shared/config/web3.ts` - использует cookie storage для SSR
- `src/app/layout.tsx` - async функция с cookieToInitialState
- `src/app/providers/Web3Provider.tsx` - принимает initialState

### Dockerfile:
- Использует multi-stage build
- deps stage: устанавливает зависимости
- builder stage: собирает Next.js
- runner stage: финальный образ

## ⚠️ Важные замечания

1. **Не ломать существующий функционал** - все изменения должны быть обратно совместимы
2. **Проверять type-check после каждого изменения**
3. **Использовать правильные типы для framer-motion 12.x + React 19**
4. **Все команды выполнять в основном потоке с полным логированием**
5. **Учитывать директории проектов** - DSP находится в `/Users/Gyber/GYBERNATY-ECOSYSTEM/DSP`

## 🚀 План действий

1. Исправить Dockerfile (добавить pnpm в builder stage)
2. Найти все использования `motion` без элемента
3. Заменить на правильные компоненты (`motion.div`, `motion.button` и т.д.)
4. Проверить type-check
5. Пересобрать образ
6. Запушить в registry
7. Обновить deployments

## 📊 Ожидаемый результат

- ✅ React 19.2.1 во всех проектах (консистентность)
- ✅ Все ошибки TypeScript исправлены
- ✅ Образ успешно собирается
- ✅ Образ запушен в registry
- ✅ Deployments обновлены и работают

---

**Начни с исправления Dockerfile и затем исправляй компоненты framer-motion по одному, проверяя type-check после каждого изменения.**


