# 🔐 Комплексный анализ безопасности Canton OTC

**Дата анализа**: 2 ноября 2025  
**Аналитик**: Senior Security Engineer  
**Методология**: S.R.A.P. (Systematic Root Analysis Protocol)  
**Статус**: Production System Security Audit

---

## 📊 EXECUTIVE SUMMARY

### Общая оценка безопасности: **7.5/10** ⚠️

**Canton OTC** - финансовый OTC/DEX проект с интеграцией блокчейна (NEAR, Canton). Система имеет **solid security foundations**, но обнаружены **критичные проблемы** в управлении секретами и валидации финансовых операций.

### Ключевые находки:

✅ **Сильные стороны:**
- Многоуровневая защита (rate limiting, input sanitization, CSP headers)
- Корректная верификация webhook подписей
- Защита от prototype pollution и XSS
- Правильное использование bcrypt для паролей

⚠️ **Критичные проблемы:**
1. **[CRITICAL] Управление секретами** - приватные ключи в environment variables
2. **[HIGH] Отсутствие проверки баланса** в swap intent creation
3. **[HIGH] Weak exchange rate validation** - допускает манипуляции
4. **[MEDIUM] Отсутствие аудита транзакций** в блокчейне
5. **[MEDIUM] Отсутствие защиты от replay attacks** в DEX API

---

## 🗺️ S - SYSTEM MAP (Карта системы)

### 1. Что защищаем? (Assets)

#### Критичные активы:
1. **Финансовые средства**:
   - USDT средства пользователей
   - Canton Coin активы
   - NEAR tokens для gas
   - Solver node private key (может подписывать транзакции)

2. **Пользовательские данные**:
   - Email адреса
   - Canton addresses
   - История транзакций
   - Order details в Google Sheets

3. **Системные секреты**:
   - `SOLVER_PRIVATE_KEY` - NEAR private key для автоматического исполнения
   - `GOOGLE_PRIVATE_KEY` - Service account для Google Sheets
   - `INTERCOM_WEBHOOK_SECRET` - Webhook verification
   - `NEXTAUTH_SECRET` - Session encryption
   - `ADMIN_PASSWORD_HASH` - Admin panel access

4. **Репутация и доверие**:
   - Способность системы выполнять транзакции
   - Защита от мошенничества
   - Соответствие заявленным security standards

### 2. Кто может атаковать? (Threat Actors)

#### Внутренние угрозы:
- Разработчики с доступом к коду/repo
- Администраторы с доступом к Kubernetes secrets
- DevOps инженеры с доступом к production

#### Внешние угрозы:
- Финансовые мошенники (цель: украсть средства через манипуляцию ценами)
- Криптовалютные хакеры (цель: приватные ключи, drain wallets)
- Автоматизированные боты (цель: DoS, spam orders)
- MEV боты (цель: front-running на DEX)
- Конкуренты (цель: reputation damage)

### 3. Где границы доверия? (Trust Boundaries)

```
┌─────────────────────────────────────────────────────────┐
│  EXTERNAL (Недоверенная зона)                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │ User Browser → Frontend → Next.js API Routes    │  │  ← Trust Boundary 1
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Frontend → NEAR Wallet (User signs)              │  │  ← Trust Boundary 2
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Intercom Webhook → API Verification              │  │  ← Trust Boundary 3
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  INTERNAL (Частично доверенная зона)                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Next.js API → Google Sheets API                 │  │  ← Trust Boundary 4
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Solver Node → NEAR Blockchain                    │  │  ← Trust Boundary 5
│  │ (Использует SOLVER_PRIVATE_KEY)                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Admin Panel → NextAuth → Database                │  │  ← Trust Boundary 6
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4. Как данные текут? (Data Flow)

#### Order Creation Flow:
```
User → Frontend → POST /api/create-order
  ↓
1. Input Validation (cantonValidationService)
2. Rate Limiting (rateLimiterService)
3. Spam Detection (antiSpamService)
4. Address Validation
5. Exchange Rate Validation (⚠️ ПРОБЛЕМА: слабая проверка)
  ↓
Background Processing:
  - Google Sheets (saveOrder)
  - Intercom (createUser + conversation)
  - Telegram (notification)
```

#### DEX Swap Flow:
```
User → Frontend → POST /api/near-intents/swap
  ↓
1. Price Oracle (REF Finance + Pyth)
2. Slippage Calculation
3. Intent Creation (⚠️ ПРОБЛЕМА: нет проверки баланса)
4. Transaction Data для подписания
  ↓
User signs → NEAR Blockchain
  ↓
Solver Node monitors → Auto-execution
  ↓
REF Finance Swap
```

#### Solver Node Flow:
```
Solver Node (Background Process)
  ↓
1. Poll NEAR Intents Contract (каждые 2-5 сек)
2. Check Profitability
3. Execute Intent (⚠️ КРИТИЧНО: использует SOLVER_PRIVATE_KEY)
4. REF Finance swap execution
5. Call fulfill_intent callback
```

---

## ⚠️ R - RISK ENUMERATION (Перечисление рисков по STRIDE)

### Компонент: Order Creation API (`/api/create-order`)

#### **S - Spoofing** (Подмена личности)
- ✅ **Защищено**: Rate limiting по IP + email
- ⚠️ **Риск**: Email можно подделать (нет email verification)
- **Критичность**: СРЕДНЯЯ (3/5)

#### **T - Tampering** (Изменение данных)
- ⚠️ **КРИТИЧНО**: Exchange rate validation слабая (1% tolerance)
- ⚠️ **ВЫСОКИЙ РИСК**: Можно манипулировать `cantonAmount` для получения большего количества монет
- **Код проблемы**:
  ```typescript:339:345:src/app/api/create-order/enhanced-route.ts
  // Exchange rate validation (prevent manipulation) - use same calculation as frontend
  const { calculateCantonAmount } = await import('@/config/otc')
  const expectedCantonAmount = calculateCantonAmount(paymentAmountUSD, true) // Apply discount like frontend
  const tolerance = expectedCantonAmount * 0.01 // 1% tolerance
  
  if (Math.abs(cantonAmount - expectedCantonAmount) > tolerance) {
    throw new Error('Invalid exchange rate calculation')
  }
  ```
- **Проблема**: 1% tolerance = до 1% манипуляции ценой
- **Критичность**: ВЫСОКАЯ (4/5)

#### **R - Repudiation** (Отказ от действий)
- ✅ **Частично защищено**: Логи в Google Sheets
- ⚠️ **Проблема**: Нет cryptographic proof (signature) от пользователя
- **Критичность**: СРЕДНЯЯ (3/5)

#### **I - Information Disclosure** (Раскрытие информации)
- ✅ **Защищено**: PII masking в логах (maskPII function)
- ⚠️ **Риск**: Error messages могут раскрывать внутреннюю логику
- **Критичность**: НИЗКАЯ (2/5)

#### **D - Denial of Service** (Отказ в обслуживании)
- ✅ **Защищено**: Rate limiting (rateLimiterService)
- ✅ **Защищено**: Spam detection (antiSpamService)
- **Критичность**: НИЗКАЯ (2/5)

#### **E - Elevation of Privilege** (Повышение привилегий)
- ✅ **Защищено**: Admin panel через NextAuth
- ⚠️ **Риск**: Нет проверки что обычный пользователь не может создать admin order
- **Критичность**: НИЗКАЯ (2/5)

---

### Компонент: DEX Swap API (`/api/near-intents/swap`)

#### **T - Tampering** (Изменение данных)
- 🚨 **КРИТИЧНО**: Нет проверки что у пользователя есть достаточный баланс токена
- **Код проблемы**:
  ```typescript:14:205:src/app/api/near-intents/swap/route.ts
  export async function POST(request: NextRequest) {
    // ... валидация полей ...
    
    // ❌ ОТСУТСТВУЕТ: Проверка баланса пользователя
    // Можно создать intent на сумму больше чем есть на балансе
    
    const intentArgs = {
      from_token: fromToken,
      amount: amountBN.toString(),
      min_receive: minReceiveBN.toString(),
      user_account: userAccount,
      // ...
    }
  }
  ```
- **Атака**: Создать swap intent на 1000 NEAR, когда баланс = 1 NEAR
- **Критичность**: ВЫСОКАЯ (4/5)

#### **R - Repudiation**
- ⚠️ **Проблема**: Нет nonce/timestamp в intent для предотвращения replay
- **Атака**: Повторное использование старого signed intent
- **Критичность**: СРЕДНЯЯ (3/5)

---

### Компонент: Solver Node

#### **I - Information Disclosure** (Раскрытие информации)
- 🚨 **КРИТИЧНО**: `SOLVER_PRIVATE_KEY` хранится в environment variable
- **Проблема**:
  ```typescript:24:40:services/solver-node/src/index.ts
  const solverAccountId = process.env.SOLVER_ACCOUNT_ID
  const solverPrivateKey = process.env.SOLVER_PRIVATE_KEY
  
  if (!solverPrivateKey) {
    console.error('❌ SOLVER_PRIVATE_KEY is required')
    process.exit(1)
  }
  ```
- **Риски**:
  1. Если кто-то получит доступ к Kubernetes pod → может прочитать env vars
  2. Логи могут случайно залогировать ключ
  3. Нет ротации ключей
  4. Нет hardware security module (HSM)
- **Критичность**: КРИТИЧНАЯ (5/5)

#### **T - Tampering**
- ✅ **Защищено**: Blockchain immutability
- ⚠️ **Риск**: Если solver node скомпрометирован → может подписывать любые транзакции
- **Критичность**: КРИТИЧНАЯ (5/5)

#### **E - Elevation of Privilege**
- 🚨 **КРИТИЧНО**: Solver имеет полный контроль над аккаунтом
- **Проблема**: Нет multi-sig или ограничений на операции
- **Критичность**: ВЫСОКАЯ (4/5)

---

### Компонент: Intercom Webhook

#### **S - Spoofing** (Подмена личности)
- ✅ **Защищено**: HMAC signature verification
  ```typescript:122:142:src/app/api/intercom/webhook/route.ts
  function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex')
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    }
  }
  ```
- **Критичность**: НИЗКАЯ (1/5)

#### **I - Information Disclosure**
- ✅ **Защищено**: PII masking в логах
- **Критичность**: НИЗКАЯ (2/5)

---

## 🎯 A - ATTACK SURFACE ANALYSIS (Анализ поверхности атаки)

### 1. Публичные эндпоинты

#### Без аутентификации:
- ✅ `POST /api/create-order` - Rate limited + spam detection
- ✅ `POST /api/near-intents/swap` - ⚠️ Нет проверки баланса
- ✅ `POST /api/near-intents/bridge` - Аналогично swap
- ✅ `POST /api/intercom/webhook` - Signature verification ✅
- ✅ `GET /api/config` - Публичные данные (OK)
- ✅ `GET /api/health` - Health check (OK)

#### С аутентификацией:
- ✅ `GET /api/admin/*` - NextAuth required
- ✅ `POST /api/admin/*` - NextAuth + CSRF protection (опционально)

### 2. Обработка пользовательского ввода

#### ✅ Хорошо защищено:
```typescript:335:435:src/lib/security/security-middleware.ts
private async sanitizeRequest(request: NextRequest): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  // Проверка на подозрительные паттерны
  const suspiciousPatterns = [
    /__proto__/, /constructor/, /prototype/,
    /eval\(/, /Function\(/, /<script/i,
    // ...
  ];
  
  // Проверка на prototype pollution
  if (this.hasPrototypePollution(parsed)) {
    return { isValid: false, reason: '...' };
  }
  
  // XSS protection
  if (this.containsXSSPayload(value)) {
    return { isValid: false, reason: '...' };
  }
}
```

#### ⚠️ Проблемы:
1. **Exchange rate validation** - только 1% tolerance, можно манипулировать
2. **Balance check отсутствует** в DEX swap API
3. **Нет nonce/timestamp** для предотвращения replay attacks

### 3. Аутентификация и авторизация

#### ✅ Хорошо:
- NextAuth 5.x с JWT
- bcrypt для паролей
- Session cookies: httpOnly, secure, sameSite

#### ⚠️ Улучшения:
- Нет 2FA для admin panel
- Нет rate limiting на login attempts
- Session maxAge = 24h (можно уменьшить для admin)

### 4. Конфигурация и секреты

#### 🚨 КРИТИЧНЫЕ ПРОБЛЕМЫ:

1. **SOLVER_PRIVATE_KEY в environment variable**
   - Нет hardware security module
   - Нет ротации ключей
   - Доступен в Kubernetes pod (можно прочитать через env)

2. **GOOGLE_PRIVATE_KEY в environment variable**
   - Service account key в plain text
   - Доступен через env vars

3. **NEXTAUTH_SECRET**
   - ✅ Правильно используется для encryption
   - ⚠️ Но нет автоматической ротации

#### ✅ Что хорошо:
- Нет hardcoded credentials в коде
- Использование environment variables
- Kubernetes secrets (если настроены)

### 5. Зависимости

#### Проверка требуется:
- `near-api-js` - последние версии?
- `googleapis` - есть ли известные CVE?
- `next-auth` - актуальная версия?
- Все остальные зависимости

**Рекомендация**: Запустить `npm audit` и `pnpm audit`

### 6. Сетевая безопасность

#### ✅ Хорошо:
- TLS в transit (HTTPS)
- Security headers (CSP, HSTS, X-Frame-Options)
- CORS настроен правильно

#### ⚠️ Проверить:
- Firewall rules для Kubernetes
- Закрыты ли debug/admin интерфейсы публично
- Rate limiting на уровне ingress

---

## 🔪 P - PATH TO COMPROMISE (Путь к компрометации)

### Атака 1: Манипуляция ценой при создании ордера

**КОРЕНЬ**: Компрометация финансов (получение большего количества Canton Coin)

**ATTACK TREE**:
```
КОРЕНЬ: Получить больше Canton Coin чем положено
│
├─ Шаг 1: Найти слабость в валидации обменного курса
│   └─ Найдено: 1% tolerance в exchange rate validation
│
├─ Шаг 2: Подготовить манипулированный запрос
│   ├─ Вариант A: Отправить cantonAmount с манипуляцией +1%
│   └─ Вариант B: Использовать timing attack на обновление цены
│
└─ Шаг 3: Эксплуатировать
    └─ Результат: Получить 1% больше Canton Coin чем должно быть
```

**Предварительные условия**:
- Знание API endpoint
- Знание текущего exchange rate
- Способность отправлять HTTP requests

**Препятствия**:
- Rate limiting (можно обойти с разных IP)
- Spam detection (можно обойти с валидным email)

**Предотвращение**:
- ✅ Есть (но слабое - 1% tolerance)
- ⚠️ Улучшить: уменьшить tolerance до 0.1% или использовать on-chain oracle

**Детекция**:
- Логирование отклоненных валидаций
- Алерты на аномалии в размере ордеров
- Мониторинг отклонений от expected exchange rate

---

### Атака 2: Создание swap intent без достаточного баланса

**КОРЕНЬ**: DoS на DEX или создание неисполнимых intents

**ATTACK TREE**:
```
КОРЕНЬ: Создать неисполнимый intent
│
├─ Шаг 1: Создать NEAR account с минимальным балансом
│   └─ Требуется: ~0.1 NEAR
│
├─ Шаг 2: Отправить POST /api/near-intents/swap
│   ├─ fromToken: NEAR
│   ├─ amount: 1000 NEAR (больше чем есть)
│   └─ userAccount: attacker.near
│
└─ Шаг 3: Получить transaction data
    └─ Проблема: Solver node будет пытаться исполнить intent,
       но не сможет (недостаточно средств)
       → Засоряет pending intents
```

**Предварительные условия**:
- NEAR account
- Знание API endpoint
- Способность создавать HTTP requests

**Препятствия**:
- ❌ НЕТ проверки баланса на этапе создания intent

**Предотвращение**:
- ❌ ОТСУТСТВУЕТ на этапе создания intent
- ✅ Solver node не сможет исполнить (но уже поздно)

**Детекция**:
- Логирование failed intents
- Мониторинг intent execution success rate

---

### Атака 3: Компрометация Solver Node

**КОРЕНЬ**: Полный контроль над средствами solver account

**ATTACK TREE**:
```
КОРЕНЬ: Получить доступ к SOLVER_PRIVATE_KEY
│
├─ Путь A: Kubernetes Pod Compromise
│   ├─ Шаг 1: Найти уязвимость в контейнере
│   │   └─ Варианты:
│   │       - RCE через зависимость
│   │       - Kubernetes misconfiguration
│   │       - Случайный доступ к pod
│   │
│   ├─ Шаг 2: Прочитать environment variables
│   │   └─ Команда: `env | grep SOLVER_PRIVATE_KEY`
│   │
│   └─ Шаг 3: Украсть средства
│       └─ Подписать транзакцию на перевод всех токенов
│
├─ Путь B: Log Injection
│   ├─ Шаг 1: Найти место где логируется sensitive data
│   └─ Шаг 2: Через ошибку получить ключ в логах
│
└─ Путь C: Code Review / Insider Threat
    └─ Разработчик с доступом к secrets → утечка
```

**Предварительные условия**:
- Доступ к Kubernetes cluster ИЛИ
- Доступ к коду/repo ИЛИ
- Способность читать логи

**Препятствия**:
- Kubernetes RBAC (если настроен)
- Логирование (если настроено маскирование)

**Предотвращение**:
- ❌ НЕТ HSM
- ❌ НЕТ key rotation
- ❌ НЕТ multi-sig
- ✅ Есть использование env vars (но не достаточно)

**Детекция**:
- Мониторинг неожиданных транзакций от solver account
- Алерты на подозрительные activity
- Audit logs всех транзакций

---

## 🔍 ROOT CAUSE ANALYSIS (Анализ корневых причин)

### Проблема 1: Слабая валидация exchange rate

**Симптом**: 1% tolerance позволяет манипулировать ценой

**5 Почему:**
1. Почему есть 1% tolerance? → Для учета floating point ошибок и задержек обновления цены
2. Почему используется такой большой tolerance? → Разработчик не учел финансовый риск
3. Почему не используется on-chain oracle? → Сложность интеграции
4. Почему нет дополнительных проверок? → Недооценен риск манипуляции
5. Почему нет мониторинга отклонений? → Отсутствие security-first подхода

**"Так что же?" → КОРНЕВАЯ ПРИЧИНА:**
- ❌ Отсутствие **security review** при разработке финансовых операций
- ❌ Недооценка **финансового риска** манипуляций
- ❌ Нет **automated security testing** для price validation

---

### Проблема 2: Отсутствие проверки баланса в DEX swap

**Симптом**: Можно создать intent на сумму больше чем есть на балансе

**5 Почему:**
1. Почему нет проверки баланса? → Предполагается что blockchain сам отклонит
2. Почему не проверяется заранее? → Упрощение архитектуры
3. Почему нет валидации на API уровне? → Не учтен DoS вектор
4. Почему solver node обрабатывает такие intents? → Нет фильтрации
5. Почему нет мониторинга failed intents? → Отсутствие observability

**"Так что же?" → КОРНЕВАЯ ПРИЧИНА:**
- ❌ Отсутствие **Defense in Depth** - полагаются только на blockchain validation
- ❌ Нет **API-level validation** для бизнес-правил
- ❌ Отсутствие **DoS protection** на уровне API

---

### Проблема 3: Хранение приватных ключей в environment variables

**Симптом**: SOLVER_PRIVATE_KEY доступен через env vars

**5 Почему:**
1. Почему ключ в env var? → Простота реализации
2. Почему не используется HSM? → Сложность и стоимость
3. Почему нет key rotation? → Не задумались о long-term security
4. Почему нет multi-sig? → Одиночный solver node
5. Почему нет monitoring на компрометацию? → Нет threat modeling

**"Так что же?" → КОРНЕВАЯ ПРИЧИНА:**
- ❌ Отсутствие **Security by Design** - не учли хранение критичных секретов
- ❌ Недооценка **Insider Threat** и **Supply Chain Attack** рисков
- ❌ Нет **Security Architecture Review** для критичных компонентов

---

## 🛡️ РЕШЕНИЯ (3 уровня мер)

### Проблема 1: Слабая валидация exchange rate

#### 1. Немедленные меры (Mitigation) - 1-2 дня
```typescript
// Уменьшить tolerance до 0.1%
const tolerance = expectedCantonAmount * 0.001 // 0.1% вместо 1%

// Добавить дополнительную проверку на сервере
const serverRate = await fetchCurrentExchangeRate() // От независимого источника
if (Math.abs(clientRate - serverRate) > 0.001) {
  throw new Error('Exchange rate mismatch detected')
}
```

**Что**: Уменьшить tolerance и добавить server-side rate validation  
**Зачем**: Предотвратить манипуляцию прямо сейчас  
**Риск если не сделать**: До 1% финансовых потерь на каждую манипуляцию

#### 2. Краткосрочные меры (Patch) - 1 неделя
- Интеграция с on-chain price oracle (если есть)
- Real-time rate validation от multiple sources
- Алерты на отклонения > 0.1%

**Таймлайн**: 1 неделя

#### 3. Долгосрочные меры (Fix) - 1 месяц
- Использование on-chain oracle для всех price checks
- Automated security testing для price validation
- Security review process для всех финансовых операций

**Таймлайн**: 1 месяц

#### 4. Мониторинг и детекция
**Что отслеживать:**
- Все отклонения от expected exchange rate
- Аномалии в размере ордеров (необычно большие отклонения)
- Частота failed validations

**Как детектировать:**
```typescript
// Alert если отклонение > 0.1%
if (Math.abs(actualAmount - expectedAmount) / expectedAmount > 0.001) {
  alertService.send('Suspicious exchange rate deviation detected', {
    orderId,
    deviation: Math.abs(actualAmount - expectedAmount) / expectedAmount,
    threshold: 0.001
  })
}
```

**Response plan**: Автоматически блокировать подозрительные ордера, уведомить админа

---

### Проблема 2: Отсутствие проверки баланса

#### 1. Немедленные меры (Mitigation) - 1 день
```typescript
// В POST /api/near-intents/swap добавить:
async function validateUserBalance(
  userAccount: string,
  tokenContract: string,
  requiredAmount: string
): Promise<boolean> {
  try {
    const rpcProvider = getProviderByNetwork(network)
    const balance = await rpcProvider.view({
      contractId: tokenContract,
      methodName: 'ft_balance_of',
      args: { account_id: userAccount }
    })
    
    const balanceBN = BigInt(balance || '0')
    const requiredBN = BigInt(requiredAmount)
    
    if (balanceBN < requiredBN) {
      return false
    }
    
    return true
  } catch (error) {
    console.error('Balance check failed:', error)
    // Fail secure: reject if can't verify
    return false
  }
}

// В route handler:
const hasBalance = await validateUserBalance(
  userAccount,
  fromTokenContract,
  amountBN.toString()
)

if (!hasBalance) {
  return NextResponse.json(
    { error: 'Insufficient balance', code: 'INSUFFICIENT_BALANCE' },
    { status: 400 }
  )
}
```

**Что**: Добавить проверку баланса перед созданием intent  
**Зачем**: Предотвратить DoS через неисполнимые intents  
**Риск если не сделать**: Solver node будет тратить ресурсы на неисполнимые intents

#### 2. Краткосрочные меры (Patch) - 1 неделя
- Добавить nonce/timestamp в intent для предотвращения replay
- Кеширование балансов для производительности
- Мониторинг failed intents

**Таймлайн**: 1 неделя

#### 3. Долгосрочные меры (Fix) - 2 недели
- Intent expiration на уровне контракта
- Automatic cleanup старых pending intents
- Defense in Depth: проверка на API + blockchain уровнях

**Таймлайн**: 2 недели

#### 4. Мониторинг и детекция
**Что отслеживать:**
- Failed intents (insufficient balance)
- Intent creation rate от одного аккаунта
- Solver node execution success rate

**Как детектировать:**
```typescript
// Alert если много failed intents
if (failedIntentsRate > 0.1) { // > 10%
  alertService.send('High failed intent rate detected', {
    rate: failedIntentsRate,
    timeWindow: '1h'
  })
}
```

---

### Проблема 3: Хранение приватных ключей в env vars

#### 1. Немедленные меры (Mitigation) - 2-3 дня
```typescript
// Использовать Kubernetes Secrets вместо env vars
// В deployment.yaml:
apiVersion: v1
kind: Secret
metadata:
  name: solver-secrets
  namespace: canton-otc
type: Opaque
data:
  SOLVER_PRIVATE_KEY: <base64 encoded>
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: solver-node
        env:
        - name: SOLVER_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: solver-secrets
              key: SOLVER_PRIVATE_KEY
```

**Что**: Переместить ключи в Kubernetes Secrets  
**Зачем**: Ограничить доступ (только для pods с правильными permissions)  
**Риск если не сделать**: Любой с доступом к pod может прочитать ключ

#### 2. Краткосрочные меры (Patch) - 2 недели
- Настроить RBAC для доступа к secrets
- Добавить audit logging всех доступа к секретам
- Реализовать key rotation process (ручной)

**Таймлайн**: 2 недели

#### 3. Долгосрочные меры (Fix) - 1-2 месяца
- Интеграция с HashiCorp Vault или AWS Secrets Manager
- Multi-sig для solver account (если возможно на NEAR)
- Hardware Security Module (HSM) для подписания транзакций
- Automated key rotation

**Таймлайн**: 1-2 месяца

#### 4. Мониторинг и детекция
**Что отслеживать:**
- Все транзакции подписанные solver account
- Неожиданные операции (не fulfill_intent)
- Попытки доступа к secrets

**Как детектировать:**
```typescript
// Alert на подозрительные транзакции
if (transaction.method !== 'fulfill_intent' && 
    transaction.contractId !== 'ref-finance.near') {
  alertService.send('Suspicious solver transaction detected', {
    transactionHash: tx.hash,
    method: transaction.method,
    contractId: transaction.contractId
  })
}
```

**Response plan**: 
1. Немедленно отключить solver node
2. Проверить все недавние транзакции
3. При необходимости - отозвать ключ и создать новый аккаунт

---

## ✅ ВАЛИДАЦИЯ РЕШЕНИЙ

### Как проверить что fixes работают:

1. **Exchange Rate Validation**:
   ```bash
   # Тест: попытка создать ордер с манипуляцией > 0.1%
   curl -X POST /api/create-order \
     -d '{"cantonAmount": 1000.2, "paymentAmountUSD": 1000}' 
   # Ожидается: ошибка валидации
   ```

2. **Balance Check**:
   ```bash
   # Тест: создать swap intent на сумму больше баланса
   curl -X POST /api/near-intents/swap \
     -d '{"amount": "1000000000000000000000000", ...}'
   # Ожидается: "Insufficient balance"
   ```

3. **Secret Management**:
   ```bash
   # Проверка: secrets не доступны через env в pod
   kubectl exec -n canton-otc deployment/solver-node -- env | grep PRIVATE_KEY
   # Ожидается: ничего или только пустая переменная
   ```

### Регрессионные тесты:

- ✅ Убедиться что валидные ордера все еще проходят
- ✅ Убедиться что валидные swaps все еще работают
- ✅ Проверить производительность (balance checks не должны замедлять API)

---

## 📋 ФИНАЛЬНЫЙ ЧЕКЛИСТ

- [x] Понимаю что защищаю (assets) и от кого (threats)
- [x] Знаю все границы доверия и как они пересекаются
- [x] Проанализировал все векторы атаки и расставил приоритеты
- [x] Нашел корневые причины проблем, а не только симптомы
- [x] Спроектировал решения на 3 уровнях: mitigation, patch, fix
- [x] Определил как валидировать что решение работает
- [x] Определил как мониторить попытки эксплуатации
- [x] Учел влияние на производительность и UX
- [x] Проверил что решение не создает новых уязвимостей

---

## 🎯 ПРИОРИТИЗАЦИЯ ИСПРАВЛЕНИЙ

### 🔴 КРИТИЧНО (исправить немедленно - в течение 1 недели):
1. ✅ Exchange rate validation (уменьшить tolerance до 0.1%)
2. ✅ Balance check в DEX swap API
3. ✅ Kubernetes Secrets для приватных ключей

### 🟡 ВЫСОКО (исправить в течение 2-4 недель):
4. Nonce/timestamp для предотвращения replay attacks
5. Key rotation process
6. Мониторинг и алерты

### 🟢 СРЕДНЕ (исправить в течение 1-2 месяцев):
7. On-chain price oracle интеграция
8. Multi-sig для solver account (если возможно)
9. Automated security testing

---

## 📚 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ БЕЗОПАСНОСТИ

### Процессные изменения:
1. **Security Review Process**: Обязательный security review для всех финансовых операций
2. **Threat Modeling**: Регулярный threat modeling для новых фич
3. **Security Training**: Обучение команды по OWASP Top 10 и финансовой безопасности
4. **Automated Security Testing**: Добавить security tests в CI/CD

### Технические улучшения:
1. **Defense in Depth**: Многоуровневая валидация на API + blockchain уровнях
2. **Security by Default**: Все новые фичи должны быть безопасными по умолчанию
3. **Least Privilege**: Ограничить права solver account до минимума необходимого
4. **Audit Logging**: Полное логирование всех критичных операций

---

**Помни:** Безопасность - это процесс, а не состояние. Регулярно обновляй этот анализ и проводи security audits.

---

**Автор**: Senior Security Engineer  
**Дата**: 2 ноября 2025  
**Версия**: 1.0  
**Статус**: COMPLETE ✅

