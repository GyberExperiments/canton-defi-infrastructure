# 📖 Canton OTC Exchange - User Stories & Business Logic

**Версия:** 1.0.0  
**Дата:** October 8, 2025  
**Статус:** Production Ready

---

## 👥 РОЛИ ПОЛЬЗОВАТЕЛЕЙ

### 1. **Покупатель (Customer)** 
- Хочет купить Canton Coin за USDT
- Использует веб-интерфейс
- Получает email уведомления

### 2. **Администратор (Admin)**
- Обрабатывает заказы вручную
- Получает Telegram уведомления
- Управляет через Google Sheets + API

### 3. **Система (System)**
- Автоматизация логирования
- Отправка уведомлений
- Валидация и защита

---

## 🎯 USER STORY 1: Успешный Обмен (Happy Path)

### **Актор:** Иван - Инвестор Canton Network

**Контекст:** 
- Иван хочет купить 10,000 Canton Coin для стейкинга
- У него есть $2,000 USDT на TRON кошельке
- Время: 15:00 (GMT+3) - рабочие часы
- Локация: Домашний компьютер (Chrome)

---

### **СЦЕНАРИЙ: Полный Цикл Обмена**

#### **ЭТАП 1: Открытие Платформы**

```
Действие Ивана:
1. Открывает https://canton-otc.com в браузере
2. Видит landing page с анимацией

Что видит Иван:
┌─────────────────────────────────────────┐
│  🔄 Canton OTC Exchange                 │
│  First Secure OTC Exchange              │
│                                         │
│  🟢 We are available daily from         │
│     8:00 AM - 10:00 PM (GMT+3)         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Exchange Rate                     │ │
│  │ 1 CC = $0.20 USDT                │ │
│  │ TRC-20 Network                    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  You Pay                                │
│  [          ] USDT                     │
│  Min: $50 • Max: $50,000               │
│                                         │
│  ⬇️                                     │
│                                         │
│  You Get                                │
│  Enter amount above                     │
│                                         │
│  [ Proceed → ]                         │
└─────────────────────────────────────────┘

Состояние системы:
- Rate limiter: 0/3 orders для IP Ивана
- Email limiter: 0/5 orders
- Services: Online (Google Sheets, Telegram, Email)
- Business hours: ✅ Active
```

**Логика:**
```typescript
// Frontend initialization
useEffect(() => {
  // Load OTC_CONFIG
  const rate = OTC_CONFIG.CANTON_COIN_PRICE_USD; // 0.20
  const hours = OTC_CONFIG.BUSINESS_HOURS; // "8:00 AM - 10:00 PM (GMT+3)"
  
  // Display exchange rate
  displayRate(`1 CC = $${rate} USDT`);
  
  // Show business hours indicator
  const now = new Date();
  const isBusinessHours = checkBusinessHours(now); // true если 8:00-22:00 GMT+3
  displayHoursIndicator(isBusinessHours);
}, []);
```

---

#### **ЭТАП 2: Ввод Суммы и Расчет**

```
Действие Ивана:
1. Кликает в поле "You Pay"
2. Начинает вводить: "2"

Что происходит (каждый символ):
Input: "2"
├─ handleUsdtChange triggered
├─ setUsdtAmount("2")
├─ calculateCantonAmount("2")
│  ├─ Parse: 2 < MIN_USDT_AMOUNT (50)
│  ├─ Toast: "Минимальная сумма: $50 USDT"
│  └─ setCantonAmount("") // Clear
└─ Button: disabled (invalid amount)

Input: "20"
├─ Parse: 20 < 50
├─ Toast: "Минимальная сумма: $50 USDT"
└─ Button: disabled

Input: "200"
├─ Parse: 200 >= 50 ✅
├─ setIsCalculating(true)
├─ setTimeout 500ms
│  └─ Calculate: 200 / 0.20 = 1000
│     ├─ formatNumber(1000) = "1,000.00"
│     ├─ setCantonAmount("1,000.00")
│     └─ setIsCalculating(false)
└─ Button: disabled (wait calculation)

After 500ms:
├─ Canton Amount: "1,000.00" ✅
└─ Button: enabled ✅

Input: "2000" (final)
├─ Parse: 2000 >= 50 && 2000 <= 50000 ✅
├─ Calculate: 2000 / 0.20 = 10000
├─ Display: "10,000.00 Canton Coin"
└─ Button: enabled "Proceed →"
```

**UI Update:**
```
┌─────────────────────────────────────────┐
│  You Pay                                │
│  [ 2000      ] 💲 USDT                 │
│  Min: $50 • Max: $50,000               │
│                                         │
│  ⬇️ 🔄                                  │
│                                         │
│  You Get                                │
│  [ 10,000.00 ] ✨ Canton Coin          │
│                                         │
│  [ Proceed → ] ← Enabled               │
│                                         │
│  ✅ Instant Exchange                   │
│  🔒 Secure Process                     │
│  📱 24/7 Support                       │
└─────────────────────────────────────────┘
```

**Логика:**
```typescript
const calculateCantonAmount = useCallback((usdt: string) => {
  if (!usdt || parseFloat(usdt) <= 0) {
    setCantonAmount('');
    return;
  }

  const usdtValue = parseFloat(usdt);
  
  // Validation
  if (usdtValue < OTC_CONFIG.MIN_USDT_AMOUNT) {
    toast.error(`Минимальная сумма: $${OTC_CONFIG.MIN_USDT_AMOUNT} USDT`);
    return;
  }
  
  if (usdtValue > OTC_CONFIG.MAX_USDT_AMOUNT) {
    toast.error(`Максимальная сумма: $${OTC_CONFIG.MAX_USDT_AMOUNT} USDT`);
    return;
  }

  setIsCalculating(true);
  
  // UX delay (500ms)
  setTimeout(() => {
    const canton = usdtValue / OTC_CONFIG.CANTON_COIN_PRICE_USD;
    setCantonAmount(formatNumber(canton)); // "10,000.00"
    setIsCalculating(false);
  }, 500);
}, []);
```

---

#### **ЭТАП 3: Переход к Wallet Details**

```
Действие Ивана:
1. Кликает "Proceed →"

Что происходит:
onClick handleProceed()
├─ Validation check
│  ├─ usdtAmount: "2000" ✅
│  ├─ cantonAmount: "10,000.00" ✅
│  ├─ isCalculating: false ✅
│  └─ Range: 50 <= 2000 <= 50000 ✅
│
├─ Parse values
│  ├─ usdtValue = parseFloat("2000") = 2000
│  └─ cantonValue = parseFloat("10,000.00".replace(',','')) = 10000
│
├─ Call onProceed({ usdtAmount: 2000, cantonAmount: 10000 })
│
└─ Parent component (page.tsx)
   ├─ setExchangeData({ usdtAmount: 2000, cantonAmount: 10000 })
   └─ setCurrentStep('wallet')

AnimatePresence triggers:
├─ ExchangeForm: exit animation (opacity 0, y: -20, 300ms)
└─ WalletDetailsForm: enter animation (opacity 1, y: 0, 300ms)
```

**UI Transition:**
```
ExchangeForm (exiting)     WalletDetailsForm (entering)
     ↓                              ↑
   fade out                      fade in
   move up                       move down
   300ms                          300ms
```

---

#### **ЭТАП 4: Заполнение Wallet Details**

```
Что видит Иван:
┌─────────────────────────────────────────┐
│  💼 Wallet Details                      │
│  Receiving Details                      │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ You're exchanging                 │ │
│  │ $2,000 USDT → 10,000 Canton Coin │ │
│  └───────────────────────────────────┘ │
│                                         │
│  💼 Canton Coin (CC) address *         │
│  [                              ]       │
│  We will send your purchased coins...   │
│                                         │
│  🛡️ Add Refund Address                 │
│  [                              ]       │
│  Safety measure: We'll use this...      │
│                                         │
│  📧 Contact Email *                    │
│  [                              ]       │
│  We will send you an email...          │
│                                         │
│  📱 WhatsApp phone number (Optional)   │
│  [                              ]       │
│                                         │
│  💬 Telegram @handle (Optional)        │
│  [                              ]       │
│                                         │
│  [ ← Back ]  [ Next → ]                │
└─────────────────────────────────────────┘

State:
formData = {
  cantonAddress: '',
  refundAddress: '',
  email: '',
  whatsapp: '',
  telegram: ''
}
errors = {}
```

**Действия Ивана:**

```
1. Canton Address Field:
Input: "canton1qyqszq"
├─ handleInputChange('cantonAddress', 'canton1qyqszq')
├─ setFormData({ ...prev, cantonAddress: 'canton1qyqszq' })
├─ Clear error: setErrors({ ...prev, cantonAddress: undefined })
└─ No validation yet (только на submit)

Input: "canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s" (complete)
├─ Length: 51 chars ✅
├─ Pattern: /^canton[a-zA-Z0-9]{40,60}$/ ✅
└─ Wait for submit validation

2. Refund Address Field:
Input: "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1" (TRON address)
├─ handleInputChange('refundAddress', ...)
└─ Will validate on submit (optional field)

3. Email Field:
Input: "ivan@example.com"
├─ handleInputChange('email', 'ivan@example.com')
├─ Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ (will check on submit)
└─ Stored in lowercase

4. WhatsApp Field:
Input: "+79123456789"
├─ handleInputChange('whatsapp', '+79123456789')
└─ Optional, no validation

5. Telegram Field:
Input: "@ivan_crypto"
├─ handleInputChange('telegram', '@ivan_crypto')
└─ Optional, no validation

Final formData:
{
  cantonAddress: 'canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s',
  refundAddress: 'TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1',
  email: 'ivan@example.com',
  whatsapp: '+79123456789',
  telegram: '@ivan_crypto'
}
```

**Валидация при клике "Next":**

```typescript
handleSubmit(e) {
  e.preventDefault();
  
  // Validation phase
  const validateForm = () => {
    const newErrors = {};
    
    // 1. Canton Address (required)
    if (!formData.cantonAddress) {
      newErrors.cantonAddress = 'Canton Coin address is required';
      return false; // ❌
    }
    
    const cantonValid = validateCantonAddress(formData.cantonAddress);
    // validateCantonAddress logic:
    //   - Length: 32-70 chars ✅ (51 chars)
    //   - Pattern: /^canton[a-zA-Z0-9]{40,60}$/ ✅
    //   - Returns: true
    
    if (!cantonValid) {
      newErrors.cantonAddress = 'Invalid Canton Coin address format';
      return false; // ❌
    }
    
    // 2. Email (required)
    if (!formData.email) {
      newErrors.email = 'Email is required';
      return false; // ❌
    }
    
    const emailValid = validateEmail(formData.email);
    // /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test('ivan@example.com') = true ✅
    
    if (!emailValid) {
      newErrors.email = 'Invalid email format';
      return false; // ❌
    }
    
    // 3. Refund Address (optional but must be valid)
    if (formData.refundAddress) {
      const refundValid = validateCantonAddress(formData.refundAddress);
      // 'TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1'
      // Canton validation fails, but...
      // Function checks other formats:
      //   - TRON: /^T[A-Za-z1-9]{33}$/ ✅ (34 chars total)
      //   - Returns: true
      
      if (!refundValid) {
        newErrors.refundAddress = 'Invalid refund address format';
        return false; // ❌
      }
    }
    
    // 4. Optional fields - no validation
    // whatsapp, telegram - любые значения ok
    
    setErrors(newErrors); // {}
    return Object.keys(newErrors).length === 0; // true ✅
  };
  
  if (!validateForm()) {
    toast.error('Please fix the form errors');
    return;
  }
  
  // Loading state
  setIsLoading(true);
  
  // Simulated delay (UX)
  setTimeout(() => {
    setIsLoading(false);
    onNext(formData); // Pass to parent
  }, 800);
}
```

**После валидации:**
```
Loading animation: 800ms
├─ Button text: "Processing..."
├─ Spinner icon rotating
└─ Button disabled

After 800ms:
├─ setCurrentStep('summary')
├─ setWalletData(formData)
└─ Navigate to OrderSummary
```

---

#### **ЭТАП 5: Order Summary & Payment**

```
Что видит Иван:
┌─────────────────────────────────────────────────────────────┐
│                   Order Summary                             │
│               Order ID: L9X2K-ABCD12                       │
│                   [ Copy ID ]                               │
│                                                             │
│  LEFT COLUMN                    RIGHT COLUMN                │
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │ ⏰ Payment Timer         │  │ 📱 QR Code to send      │ │
│  │   29:59                  │  │                         │ │
│  │ Complete payment...      │  │  ┌─────────────────┐   │ │
│  └──────────────────────────┘  │  │   [QR CODE]     │   │ │
│                                 │  │                 │   │ │
│  ┌──────────────────────────┐  │  └─────────────────┘   │ │
│  │ Payment Instructions      │  │ Scan with TRON wallet  │ │
│  │                          │  └─────────────────────────┘ │
│  │ You need to send:        │                              │
│  │ $2,000.00 USDT          │  ┌─────────────────────────┐ │
│  │ TRC-20 Network          │  │ Exchange Progress       │ │
│  │                          │  │                         │ │
│  │ Send funds to:          │  │ ①──②──③──④──⑤         │ │
│  │ ┌────────────────────┐  │  │ 🟠 Active              │ │
│  │ │ TKau36dpRi...3N5Q1│  │  │                         │ │
│  │ │ [ Copy Address ]   │  │  │ Awaiting deposit       │ │
│  │ └────────────────────┘  │  │ Send USDT to address   │ │
│  │                          │  └─────────────────────────┘ │
│  │ ⚠️ Amount: $2,000 USDT  │                              │
│  │    To: TKau36dpRi...   │  ┌─────────────────────────┐ │
│  └──────────────────────────┘  │ Need Help?              │ │
│                                 │ Telegram: @canton_otc   │ │
│  ┌──────────────────────────┐  │ Email: support@...      │ │
│  │ ✨ You will receive      │  └─────────────────────────┘ │
│  │ 10,000.00 Canton Coin   │                              │
│  │ Address: canton1...     │                              │
│  └──────────────────────────┘                              │
│                                                             │
│               [ ← Back ]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Что происходит при загрузке:**

```typescript
useEffect(() => {
  // 1. Generate Order ID
  const orderId = generateOrderId();
  // Implementation:
  //   const timestamp = Date.now().toString(36); // "l9x2k"
  //   const random = Math.random().toString(36).substring(2, 8); // "abcd12"
  //   return `${timestamp}-${random}`.toUpperCase(); // "L9X2K-ABCD12"
  
  // 2. Generate QR Code
  const qrString = `tron:${OTC_CONFIG.USDT_RECEIVING_ADDRESS}?amount=${orderData.usdtAmount}&token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;
  // Result: "tron:TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1?amount=2000&token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
  
  QRCodeCanvas.toDataURL(qrString, {
    width: 200,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  }).then(qrDataUrl => {
    setQrCodeUrl(qrDataUrl); // base64 image
  });
  
  // 3. Start Timer
  setTimeLeft(1800); // 30 minutes = 1800 seconds
  const timer = setInterval(() => {
    setTimeLeft(prev => {
      if (prev <= 0) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  // 4. Create Order Object
  const order: OTCOrder = {
    orderId: 'L9X2K-ABCD12',
    timestamp: Date.now(), // 1728393000000
    usdtAmount: 2000,
    cantonAmount: 10000,
    cantonAddress: 'canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s',
    refundAddress: 'TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1',
    email: 'ivan@example.com',
    whatsapp: '+79123456789',
    telegram: '@ivan_crypto',
    status: 'awaiting-deposit'
  };
  
  // 5. Save Order via API
  fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  }).then(async response => {
    const result = await response.json();
    
    if (result.success) {
      toast.success('Order created successfully!');
      console.log('📊 Order saved:', result);
    } else {
      toast.error(`Failed to create order: ${result.error}`);
    }
  });
  
}, []);
```

---

#### **ЭТАП 6: API - Create Order Processing**

```
API Request:
POST /api/create-order
Headers: { "Content-Type": "application/json" }
Body: {
  orderId: "L9X2K-ABCD12",
  timestamp: 1728393000000,
  usdtAmount: 2000,
  cantonAmount: 10000,
  cantonAddress: "canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s",
  refundAddress: "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
  email: "ivan@example.com",
  whatsapp: "+79123456789",
  telegram: "@ivan_crypto"
}

Backend Processing Flow:
═══════════════════════════════════════════════════════════

STEP 1: Get Client IP
├─ Headers check:
│  ├─ x-forwarded-for: "95.123.45.67, 10.0.0.1" → Take first: "95.123.45.67"
│  ├─ x-real-ip: null
│  └─ cf-connecting-ip: null
└─ Result: clientIP = "95.123.45.67"

STEP 2: Rate Limiting Check
├─ IP Limiter (Order Creation):
│  ├─ Key: "95.123.45.67"
│  ├─ Current: 0/3 points used
│  ├─ Consume 1 point
│  └─ Remaining: 2/3 points ✅
│
└─ Email Limiter:
   ├─ Key: "ivan@example.com"
   ├─ Current: 0/5 points used (24h window)
   ├─ Consume 1 point
   └─ Remaining: 4/5 points ✅

Result: Rate limit OK, continue

STEP 3: Parse & Validate Request
├─ JSON parse: ✅
├─ Required fields:
│  ├─ orderId: "L9X2K-ABCD12" ✅
│  ├─ usdtAmount: 2000 ✅
│  ├─ cantonAmount: 10000 ✅
│  ├─ cantonAddress: "canton1..." ✅
│  └─ email: "ivan@example.com" ✅
│
├─ Type conversion:
│  ├─ usdtAmount: Number(2000) = 2000 ✅
│  ├─ cantonAmount: Number(10000) = 10000 ✅
│  └─ email: "ivan@example.com".toLowerCase() = "ivan@example.com"
│
├─ Amount validation:
│  ├─ 2000 >= MIN_USDT_AMOUNT (50) ✅
│  ├─ 2000 <= MAX_USDT_AMOUNT (50000) ✅
│  └─ Both > 0 ✅
│
└─ Email validation:
   ├─ Pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
   └─ Test: "ivan@example.com" ✅

STEP 4: Exchange Rate Verification (Anti-Manipulation)
├─ Client sent: cantonAmount = 10000
├─ Server calculates: 2000 / 0.20 = 10000
├─ Difference: |10000 - 10000| = 0
├─ Tolerance: 1% of 10000 = 100
├─ Check: 0 <= 100 ✅
└─ Result: Exchange rate valid

STEP 5: Spam Detection
├─ Suspicious Email Check:
│  ├─ Pattern: /^\d+@/ → false (starts with "ivan")
│  ├─ Pattern: /@(tempmail|...)/ → false
│  ├─ Pattern: /[^\w\-_.@]/ → false (only valid chars)
│  ├─ Pattern: /.{50,}@/ → false (7 chars before @)
│  └─ Score: 0 ✅
│
├─ Suspicious Amount Check:
│  ├─ Amount: 2000
│  ├─ < 1 ? false
│  ├─ > 100000 ? false
│  └─ Score: 0 ✅
│
├─ Duplicate Order Check:
│  ├─ Key: "ivan@example.com:canton1...:2000"
│  ├─ Cache lookup: null (first order)
│  ├─ Store in cache with timestamp
│  └─ Score: 0 ✅
│
├─ Suspicious IP Check:
│  ├─ IP: "95.123.45.67"
│  ├─ Pattern: /^10\.|^192\.168\.|.../ → false (public IP)
│  └─ Score: 0 ✅
│
└─ Total Score: 0 + 0 + 0 + 0 = 0 < 50 ✅
   Result: NOT SPAM

STEP 6: Canton Address Validation
├─ cantonValidationService.validateCantonAddress(...)
├─ Input: "canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s"
├─ Length: 51 chars (32-70 range) ✅
├─ Pattern 1: /^canton[a-zA-Z0-9]{40,60}$/ ✅ MATCH
├─ Result: {
│    isValid: true,
│    format: "Canton mainnet address format"
│  }
└─ Status: ✅

STEP 7: Refund Address Validation
├─ cantonValidationService.validateRefundAddress(...)
├─ Input: "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1"
├─ Try Canton formats: false
├─ Try other formats:
│  ├─ TRON: /^T[A-Za-z1-9]{33}$/
│  ├─ Test: "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1" (34 chars)
│  └─ Match: ✅
├─ Result: {
│    isValid: true,
│    format: "TRON (TRX) address"
│  }
└─ Status: ✅

All validations passed! Proceed to save...

STEP 8: Create Order Object
const order: OTCOrder = {
  orderId: "L9X2K-ABCD12",
  timestamp: 1728393000000,
  usdtAmount: 2000,
  cantonAmount: 10000,
  cantonAddress: "canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s",
  refundAddress: "TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1",
  email: "ivan@example.com",
  whatsapp: "+79123456789",
  telegram: "@ivan_crypto",
  status: "awaiting-deposit"
}

STEP 9: Parallel Service Execution
Promise.allSettled([
  googleSheetsService.saveOrder(order),
  telegramService.sendOrderNotification(order),
  emailService.sendOrderConfirmation(order)
])

┌─────────────────────────────────────────────────────────┐
│ Service 1: Google Sheets                                │
├─────────────────────────────────────────────────────────┤
│ 1. Authenticate with JWT                                │
│    ├─ Email: canton-otc@project.iam.gserviceaccount.com│
│    ├─ Key: [PRIVATE_KEY]                               │
│    └─ Scopes: spreadsheets                             │
│                                                         │
│ 2. Prepare row data:                                    │
│    [                                                     │
│      "L9X2K-ABCD12",              // A: Order ID        │
│      "2025-10-08T12:30:00.000Z",  // B: Timestamp      │
│      2000,                         // C: USDT Amount    │
│      10000,                        // D: Canton Amount  │
│      "canton1...",                 // E: Canton Address │
│      "TKau36dpRi...",             // F: Refund Address │
│      "ivan@example.com",          // G: Email          │
│      "+79123456789",              // H: WhatsApp       │
│      "@ivan_crypto",              // I: Telegram       │
│      "awaiting-deposit",          // J: Status         │
│      "",                          // K: TX Hash        │
│      "08/10/2025, 15:30:00"       // L: Created At     │
│    ]                                                     │
│                                                         │
│ 3. Append to sheet:                                     │
│    ├─ SpreadsheetId: [GOOGLE_SHEET_ID]                │
│    ├─ Range: "Orders!A:L"                              │
│    ├─ ValueInputOption: RAW                            │
│    └─ Result: Row added at A15 (example)              │
│                                                         │
│ 4. Response:                                            │
│    status: "fulfilled"                                  │
│    value: true                                          │
│    duration: ~150ms                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Service 2: Telegram Bot                                 │
├─────────────────────────────────────────────────────────┤
│ 1. Format message (HTML):                               │
│                                                         │
│ 🔥 <b>НОВАЯ OTC ЗАЯВКА</b>                            │
│                                                         │
│ 📋 <b>ID:</b> <code>L9X2K-ABCD12</code>               │
│ 💰 <b>Сумма:</b> $2000 USDT → 10000 Canton Coin       │
│ 📅 <b>Время:</b> 08.10.2025, 15:30 (МСК)             │
│                                                         │
│ 👤 <b>ПОЛУЧАТЕЛЬ:</b>                                  │
│ 🏛️ Canton: <code>canton1qyqszq...</code>             │
│ 🔄 Refund: <code>TKau36dpRi...</code>                 │
│                                                         │
│ 📞 <b>КОНТАКТЫ:</b>                                    │
│ 📧 ivan@example.com                                     │
│ 📱 +79123456789                                        │
│ 📟 @ivan_crypto                                        │
│                                                         │
│ 🎯 <b>СТАТУС:</b> 🟠 awaiting-deposit                 │
│                                                         │
│ 🚨 <b>ОЖИДАЕТСЯ ДЕПОЗИТ:</b>                          │
│ <code>TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1</code>       │
│                                                         │
│ ⏰ Обработка: 8:00 AM - 10:00 PM (GMT+3)              │
│                                                         │
│ 2. Send to Telegram:                                    │
│    ├─ URL: https://api.telegram.org/bot[TOKEN]/...    │
│    ├─ chat_id: [TELEGRAM_CHAT_ID]                     │
│    ├─ parse_mode: HTML                                 │
│    └─ disable_web_page_preview: true                   │
│                                                         │
│ 3. Response:                                            │
│    status: "fulfilled"                                  │
│    value: true                                          │
│    duration: ~100ms                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Service 3: Email (SMTP)                                 │
├─────────────────────────────────────────────────────────┤
│ 1. Create HTML email template                          │
│                                                         │
│ Subject: Order Confirmation - L9X2K-ABCD12             │
│ From: "Canton OTC Exchange" <support@canton-otc.com>   │
│ To: ivan@example.com                                    │
│                                                         │
│ [HTML Template with gradient header, order details,    │
│  payment instructions, 5-step process, support info]   │
│                                                         │
│ 2. Send via SMTP:                                       │
│    ├─ Host: smtp.gmail.com                             │
│    ├─ Port: 587                                        │
│    ├─ Secure: false (STARTTLS)                         │
│    ├─ Auth: [EMAIL_USER]:[EMAIL_PASSWORD]             │
│    └─ Transport: Nodemailer                            │
│                                                         │
│ 3. Response:                                            │
│    status: "fulfilled"                                  │
│    value: true                                          │
│    messageId: "<abc123@gmail.com>"                     │
│    duration: ~120ms                                     │
└─────────────────────────────────────────────────────────┘

STEP 10: Response to Frontend
{
  "success": true,
  "orderId": "L9X2K-ABCD12",
  "message": "Order created successfully",
  "status": "awaiting-deposit",
  "notifications": {
    "sheets": true,
    "telegram": true,
    "email": true
  },
  "validation": {
    "cantonAddress": "Canton mainnet address format",
    "refundAddress": "TRON (TRX) address"
  }
}

Total processing time: ~370ms
├─ Rate limiting: 5ms
├─ Validation: 10ms
├─ Spam detection: 5ms
├─ Services (parallel): 150ms (max)
└─ Response formation: 200ms (network)
```

---

#### **ЭТАП 7: Иван Отправляет USDT**

```
Что делает Иван:

Option A: Через QR Code (Mobile Wallet)
1. Открывает TronLink Wallet на телефоне
2. Сканирует QR code
3. Кошелек автоматически заполняет:
   ├─ Receiving Address: TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1
   ├─ Token: USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)
   └─ Amount: 2000 USDT
4. Подтверждает транзакцию
5. Ждет ~1-3 минуты (TRON block time)

Option B: Manual Transfer (Desktop)
1. Открывает Binance/другую биржу
2. Withdraw → USDT → TRC-20
3. Копирует address из Order Summary
   ├─ Клик "Copy Address"
   ├─ Toast: "Wallet address copied to clipboard!"
   └─ Paste в форму withdrawal
4. Вводит amount: 2000 USDT
5. Подтверждает 2FA
6. Ждет processing (~5-10 мин)

Transaction details:
├─ From: Иван's wallet (0xABC...)
├─ To: TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1
├─ Amount: 2000 USDT
├─ Token: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
├─ Network: TRON (TRC-20)
├─ Fee: ~1 TRX (~$0.10)
└─ TX Hash: 0x1234567890abcdef... (TRON blockchain)

TRON Blockchain:
├─ Block confirmed in ~3 seconds
├─ 19 confirmations for safety (~1 minute)
└─ Transaction visible on TronScan

Что получает Иван:
├─ Email: "Order Confirmation" (уже получил)
├─ Order ID: L9X2K-ABCD12 (для tracking)
└─ Status на странице: "Awaiting deposit" 🟠
```

---

#### **ЭТАП 8: Администратор Получает Уведомление**

```
Кто: Администратор (Алексей)
Где: Telegram группа "Canton OTC Admin"

Получает сообщение:
┌──────────────────────────────────────────────┐
│ Canton OTC Bot              Today at 15:30    │
├──────────────────────────────────────────────┤
│ 🔥 НОВАЯ OTC ЗАЯВКА                          │
│                                               │
│ 📋 ID: L9X2K-ABCD12                          │
│ 💰 Сумма: $2000 USDT → 10000 Canton Coin    │
│ 📅 Время: 08.10.2025, 15:30 (МСК)          │
│                                               │
│ 👤 ПОЛУЧАТЕЛЬ:                                │
│ 🏛️ Canton Address:                          │
│    canton1qyqszqgpqyqszqgpqyqszq...         │
│ 🔄 Refund Address:                           │
│    TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1       │
│                                               │
│ 📞 КОНТАКТЫ:                                  │
│ 📧 Email: ivan@example.com                   │
│ 📱 WhatsApp: +79123456789                   │
│ 📟 Telegram: @ivan_crypto                    │
│                                               │
│ 🎯 СТАТУС: 🟠 awaiting-deposit               │
│                                               │
│ 🚨 ОЖИДАЕТСЯ ДЕПОЗИТ НА:                    │
│    TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1       │
│                                               │
│ ⏰ Обработка в рабочие часы:                 │
│    8:00 AM - 10:00 PM (GMT+3)               │
└──────────────────────────────────────────────┘

Также получает в Google Sheets:
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ A             │ B                        │ C    │ D     │ E          │ F          │ G                │ H            │...
├───────────────┼──────────────────────────┼──────┼───────┼────────────┼────────────┼──────────────────┼──────────────┤
│ Order ID      │ Timestamp                │ USDT │Canton │Canton Addr │Refund Addr │ Email            │ WhatsApp     │...
│ L9X2K-ABCD12  │ 2025-10-08T12:30:00.000Z │ 2000 │ 10000 │ canton1... │ TKau36...  │ivan@example.com  │+79123456789  │...
└───────────────┴──────────────────────────┴──────┴───────┴────────────┴────────────┴──────────────────┴──────────────┘

Действия Алексея:
1. Видит уведомление в Telegram
2. Открывает Google Sheets для деталей
3. Копирует адрес получения: TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1
4. Открывает TronScan.org
5. Вставляет адрес в поиск
6. Проверяет транзакции (ждет пока Иван отправит)
```

---

#### **ЭТАП 9: Верификация Платежа Администратором**

```
Через 5 минут после создания заказа...

Алексей проверяет TronScan:
URL: https://tronscan.org/#/address/TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1

Видит новую транзакцию:
┌─────────────────────────────────────────────────────┐
│ Hash: 0x1234567890abcdef...                         │
│ From: TCxyz123... (Иван's wallet)                   │
│ To: TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1             │
│ Token: USDT (TRC-20)                                │
│ Amount: 2,000 USDT                                  │
│ Status: ✅ Success                                  │
│ Confirmations: 27/19                                │
│ Time: 2025-10-08 15:35:23 (5 min ago)              │
└─────────────────────────────────────────────────────┘

Verification Checklist:
├─ ✅ Amount: 2,000 USDT (matches order)
├─ ✅ Token: USDT TRC-20 (correct network)
├─ ✅ To Address: TKau36... (our receiving address)
├─ ✅ Confirmations: 27 (>19 required)
├─ ✅ Status: Success (no errors)
└─ ✅ Time: Within 30min timer

Алексей принимает решение:
"Платеж verified ✅ - можно обрабатывать"

Действия:
1. Открывает Google Sheets
2. Находит row Order ID: L9X2K-ABCD12
3. Меняет Status (column J):
   ├─ Было: "awaiting-deposit"
   └─ Стало: "awaiting-confirmation"
4. Saves (auto-sync)

ИЛИ через Admin API:
curl -X PUT https://canton-otc.com/api/order-status/L9X2K-ABCD12 \
  -H "Content-Type: application/json" \
  -d '{
    "adminKey": "[ADMIN_API_KEY]",
    "status": "awaiting-confirmation"
  }'

Backend Processing:
POST /api/order-status/L9X2K-ABCD12
├─ Validate adminKey ✅
├─ Validate status value ✅
├─ Find order in Google Sheets
│  ├─ Get all rows from "Orders!A:K"
│  ├─ Find index where row[0] === "L9X2K-ABCD12"
│  └─ Found at row 15
├─ Update cell J15: "awaiting-confirmation"
├─ Batch update to Sheets
└─ Response: { success: true, status: "awaiting-confirmation" }

Иван получает email update:
Subject: Order Status Update - L9X2K-ABCD12
Body:
  🔄 ОБНОВЛЕНИЕ СТАТУСА
  
  📋 Order ID: L9X2K-ABCD12
  💰 Сумма: $2000 USDT → 10000 CC
  📅 Обновлено: 08.10.2025, 15:40 (МСК)
  
  🎯 НОВЫЙ СТАТУС: 🔵 awaiting-confirmation
  
  We are verifying your USDT payment.
  This usually takes 15-30 minutes.
  You will receive an email update soon.
```

---

#### **ЭТАП 10: Обмен и Отправка Canton Coin**

```
Через 20 минут...

Алексей готов отправить Canton Coin:

1. Открывает Canton Network Wallet
2. Connects to Canton Network
3. Отправляет транзакцию:
   ├─ From: Canton OTC Treasury Wallet
   ├─ To: canton1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz5c3j9s
   ├─ Amount: 10,000 Canton Coin
   ├─ Gas: 0.001 CC
   └─ Memo: "OTC Order L9X2K-ABCD12"

4. Подтверждает транзакцию
5. Получает TX Hash:
   0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

6. Updates order status:
   
   Вариант A: Google Sheets manual
   ├─ Column J (Status): "sending" → "completed"
   └─ Column K (TX Hash): "0xabcdef..."
   
   Вариант B: Admin API
   curl -X PUT .../api/order-status/L9X2K-ABCD12 \
     -d '{
       "adminKey": "...",
       "status": "completed",
       "txHash": "0xabcdef1234567890..."
     }'

Backend triggers:
├─ Update Google Sheets
│  ├─ J15: "completed"
│  └─ K15: "0xabcdef1234..."
│
├─ Send Telegram notification (to admin)
│  └─ "🔄 Order L9X2K-ABCD12 completed ✅"
│
└─ Send Email to customer
   Subject: Order Completed - L9X2K-ABCD12
   
   ┌──────────────────────────────────────────┐
   │ 🎉 Congratulations!                      │
   │                                          │
   │ Your Canton Coin exchange completed!     │
   │                                          │
   │ 📋 Order ID: L9X2K-ABCD12               │
   │ 💰 Received: 10,000 Canton Coin         │
   │ 📍 To: canton1qyqszq...                 │
   │ 🔗 TX: 0xabcdef123...                   │
   │                                          │
   │ Your Canton Coins are now in your       │
   │ wallet! You can use them for staking,   │
   │ governance, and DeFi in Canton Network. │
   │                                          │
   │ Thank you for choosing Canton OTC! 🏛️   │
   └──────────────────────────────────────────┘
```

---

#### **ЭТАП 11: Подтверждение и Завершение**

```
Иван проверяет свой кошелек:

1. Открывает Canton Network Wallet
2. Sees balance update:
   ├─ Before: 0 CC
   └─ After: 10,000 CC ✨

3. Проверяет транзакцию:
   ├─ TX Hash: 0xabcdef1234...
   ├─ From: Canton OTC Treasury
   ├─ To: His address
   ├─ Amount: 10,000 CC
   ├─ Status: ✅ Confirmed
   └─ Timestamp: 08.10.2025 16:05

4. Получил 3 email:
   ├─ 1. Order Confirmation (15:30)
   ├─ 2. Status Update: awaiting-confirmation (15:40)
   └─ 3. Order Completed (16:05)

Total time: 35 minutes
├─ Order creation: 15:30
├─ Payment sent: 15:35 (5 min)
├─ Payment verified: 15:40 (10 min)
├─ Canton sent: 16:05 (25 min)
└─ Completed: 16:05 (35 min total)

Final State:
┌────────────────────────────────────────────┐
│ Google Sheets Row:                         │
├────────────────────────────────────────────┤
│ Order ID: L9X2K-ABCD12                    │
│ Status: completed ✅                       │
│ TX Hash: 0xabcdef1234...                  │
│ Created: 08/10/2025, 15:30:00             │
│ USDT: 2000                                 │
│ Canton: 10000                              │
│ Customer: ivan@example.com                 │
└────────────────────────────────────────────┘

Rate Limits Updated:
├─ IP "95.123.45.67": 1/3 orders used
├─ Email "ivan@example.com": 1/5 orders used
└─ Both reset in: 23h 25min

Statistics:
├─ Total orders today: 1
├─ Total volume: $2,000 USDT
├─ Total Canton distributed: 10,000 CC
├─ Success rate: 100%
└─ Avg processing time: 35 minutes
```

**🎉 SUCCESS! Иван успешно обменял $2,000 USDT на 10,000 Canton Coin**

---

## ❌ USER STORY 2: Неудачные Сценарии (Error Cases)

### **SCENARIO A: Rate Limit Exceeded**

```
Пользователь: Максим (Спамер)

Попытка 1: 14:00
├─ Order: $100 USDT
├─ Status: ✅ Created
└─ Rate limit: 1/3

Попытка 2: 14:05
├─ Order: $200 USDT
├─ Status: ✅ Created
└─ Rate limit: 2/3

Попытка 3: 14:10
├─ Order: $150 USDT
├─ Status: ✅ Created
└─ Rate limit: 3/3

Попытка 4: 14:12
├─ Order: $500 USDT
├─ Rate limit check: 3/3 (EXCEEDED!)
└─ Response:
   {
     "error": "Rate limit exceeded. Please wait 48 minute(s) and try again.",
     "code": "RATE_LIMIT_EXCEEDED"
   }
   Status: 429 Too Many Requests
   Headers: {
     "X-RateLimit-Limit": "3",
     "X-RateLimit-Remaining": "0",
     "X-RateLimit-Reset": "1728396000",
     "Retry-After": "2880"
   }

Frontend:
├─ Toast error: "Rate limit exceeded. Please wait 48 minutes..."
└─ Form disabled временно

Максим видит:
"⚠️ You've made too many orders. Please try again later."

Решение:
├─ Wait 48 minutes (до 15:00)
└─ OR contact admin для whitelist
```

---

### **SCENARIO B: Spam Detection**

```
Пользователь: Suspicious Actor

Order attempt:
{
  email: "123456@tempmail.com",
  usdtAmount: 0.50,
  cantonAddress: "short",
  ...
}

Spam Detection Scoring:
├─ Email pattern /^\d+@/: +30 (starts with numbers)
├─ Domain /@tempmail/: +30 (temp mail service)
├─ Amount 0.50 < 1: +20 (suspicious amount)
├─ Address length: valid (no score)
└─ Total: 30 + 30 + 20 = 80 > 50 threshold

Result: SPAM DETECTED ❌

Response:
{
  "error": "Request flagged as suspicious",
  "code": "SPAM_DETECTED"
}
Status: 400 Bad Request

Frontend:
Toast: "⚠️ Your request cannot be processed. Please contact support."

Backend Log:
"Spam detected: Suspicious email pattern, temp mail services, Suspicious transaction amount
 Confidence: 80%"

Actions:
├─ Order NOT created
├─ No notifications sent
├─ IP logged для analysis
└─ Rate limit point NOT consumed
```

---

### **SCENARIO C: Invalid Canton Address**

```
Пользователь: Новичок (неправильный адрес)

Input в Wallet Details Form:
Canton Address: "canton123"

Frontend Validation (on submit):
├─ validateCantonAddress("canton123")
│  ├─ Length: 10 chars < 32 minimum ❌
│  └─ Return: false
│
├─ Error set: "Invalid Canton Coin address format"
└─ Form submit blocked

UI показывает:
┌──────────────────────────────────────────┐
│ 💼 Canton Coin (CC) address *           │
│ [ canton123                    ]         │
│ ⚠️ Invalid Canton Coin address format   │
└──────────────────────────────────────────┘

User не может продолжить пока не введет valid address

If somehow bypasses frontend и sends к API:

Backend Validation:
├─ cantonValidationService.validateCantonAddress("canton123")
├─ Length check: 10 < 32 ❌
├─ Result: { isValid: false, error: "Address is too short" }
└─ Response:
   {
     "error": "Invalid Canton address: Address is too short",
     "code": "INVALID_ADDRESS"
   }
   Status: 400

Protection layers:
1. Frontend validation ✅
2. Backend validation ✅
3. Type checking ✅
```

---

### **SCENARIO D: Payment Timeout**

```
User: Забывчивый Пользователь

Timeline:
15:00 - Order created
├─ Timer starts: 30:00
├─ QR code generated
└─ Email confirmation sent

15:10 - User distracted (phone call)
15:20 - Timer: 10:00 remaining
15:25 - Timer: 05:00 remaining (orange warning)
15:30 - Timer: 00:00 ❌ EXPIRED

UI показывает:
┌──────────────────────────────────────────┐
│ ⏰ Payment Timer                         │
│    00:00                                 │
│ ⚠️ Payment time expired                 │
└──────────────────────────────────────────┘

Что происходит:
├─ Timer stops at 00:00
├─ No automatic order cancellation
├─ Order status: still "awaiting-deposit"
└─ User can still pay (admin will verify timestamp)

Admin options:
1. Accept late payment (if within reasonable time)
2. Refund to refund address
3. Cancel order

User action:
├─ Contact support: support@canton-otc.com
├─ Provide Order ID: L9X2K-ABCD12
└─ Explain situation

Resolution:
Admin extends timer or accepts payment manually
```

---

### **SCENARIO E: Wrong Network Payment**

```
User: Невнимательный (отправил USDT ERC-20 вместо TRC-20)

Order details:
├─ Amount: $1,000 USDT
├─ Network: TRC-20 (TRON)
└─ Address: TKau36dpRiTENTjhdJVU4DhoFzX9x3N5Q1

User mistake:
├─ Selected: Ethereum (ERC-20)
├─ Sent to: TKau36... (но это TRON address!)
└─ Result: Transaction failed / Lost funds

What happens:
├─ Ethereum network: Address invalid (не ERC-20 format)
├─ Transaction: Rejected by network
└─ OR funds sent to wrong network (irrecoverable)

Admin cannot verify:
├─ Checks TronScan: No transaction found
├─ Status remains: "awaiting-deposit"
└─ After 24h: Contact user

User contact support:
"I sent USDT but you didn't receive it!"

Support process:
1. Ask for TX hash
2. Check blockchain:
   ├─ If failed: Tell user to retry with TRC-20
   └─ If sent to wrong network: Cannot recover (blockchain limitation)

3. Refund process:
   ├─ If recoverable: Refund minus network fees
   └─ If not: Explain blockchain finality

Prevention:
├─ Clear instructions: "TRC-20 Network" highlighted
├─ QR code: Includes network info
├─ Email: Emphasizes TRC-20
└─ Future: Add network detection warning
```

---

### **SCENARIO F: Service Failure (Google Sheets Down)**

```
Situation: Google Sheets API временно unavailable

Order creation attempt:
├─ Rate limiting: ✅ Pass
├─ Validation: ✅ Pass
├─ Spam detection: ✅ Pass
└─ Parallel services:
   ├─ Google Sheets: ❌ FAILED (timeout/503)
   ├─ Telegram: ✅ Success
   └─ Email: ✅ Success

Service 1 Error:
googleSheetsService.saveOrder(order)
├─ authenticate(): Success
├─ sheets.spreadsheets.values.append(...)
├─ Error: 503 Service Unavailable
├─ Catch block:
│  └─ console.error('Failed to save to Google Sheets:', error)
└─ Return: false

Promise.allSettled result:
[
  { status: "rejected", reason: Error("503 Service Unavailable") },
  { status: "fulfilled", value: true },
  { status: "fulfilled", value: true }
]

Response to user:
{
  "success": true,
  "orderId": "L9X2K-ABCD12",
  "message": "Order created successfully",
  "status": "awaiting-deposit",
  "notifications": {
    "sheets": false,  // ← Failed but order still created
    "telegram": true,
    "email": true
  }
}

Graceful degradation:
├─ User: Gets Order ID + Email ✅
├─ Admin: Gets Telegram notification ✅
├─ Database: NOT logged (issue)
└─ Fallback: Admin adds manually to Sheets

Admin receives Telegram:
"🔥 НОВАЯ OTC ЗАЯВКА
...
⚠️ Note: Order not logged to Sheets (service issue)
Please add manually: L9X2K-ABCD12"

Recovery:
1. Admin manually adds row to Google Sheets
2. Or system retries после service восстановления
3. Or local fallback logging (future enhancement)
```

---

## 🔄 STATE MACHINE DIAGRAM

```
Order Status State Machine:
═══════════════════════════════════════════════════════════

    [START]
       ↓
       ↓ User creates order
       ↓
  ┌────────────────────┐
  │ awaiting-deposit   │ 🟠
  │ (Initial State)    │
  └────────────────────┘
       ↓
       ↓ User sends USDT
       ↓ (Admin verifies)
       ↓
  ┌────────────────────────┐
  │ awaiting-confirmation  │ 🔵
  │ (Payment received)     │
  └────────────────────────┘
       ↓
       ↓ Admin confirms payment
       ↓
  ┌────────────────────┐
  │   exchanging       │ 🟡
  │ (Processing)       │
  └────────────────────┘
       ↓
       ↓ Admin prepares Canton transfer
       ↓
  ┌────────────────────┐
  │     sending        │ 🟢
  │ (Canton transfer)  │
  └────────────────────┘
       ↓
       ↓ Transaction confirmed
       ↓
  ┌────────────────────┐
  │    completed       │ ✅
  │ (Final State)      │
  └────────────────────┘
       ↓
    [END]

Error path (any state):
       ↓ Issue detected
       ↓
  ┌────────────────────┐
  │      failed        │ ❌
  │ (Error State)      │
  └────────────────────┘
       ↓
       ↓ Refund initiated
       ↓
    [REFUND]

Valid State Transitions:
• awaiting-deposit → awaiting-confirmation
• awaiting-deposit → failed
• awaiting-confirmation → exchanging
• awaiting-confirmation → failed
• exchanging → sending
• exchanging → failed
• sending → completed
• sending → failed
• failed → awaiting-deposit (retry)

Invalid Transitions (blocked):
✗ awaiting-deposit → completed (skip steps)
✗ completed → any state (final)
✗ exchanging → awaiting-deposit (backwards)
```

---

## 📊 BUSINESS LOGIC RULES

### **Rule 1: Exchange Rate Calculation**

```typescript
FORMULA:
Canton Amount = USDT Amount / CANTON_COIN_PRICE_USD

WHERE:
- CANTON_COIN_PRICE_USD = 0.20 (constant)
- USDT Amount: User input ($50 - $50,000)
- Canton Amount: Calculated result

EXAMPLES:
$50 USDT ÷ $0.20 = 250 Canton Coin
$100 USDT ÷ $0.20 = 500 Canton Coin
$1,000 USDT ÷ $0.20 = 5,000 Canton Coin
$10,000 USDT ÷ $0.20 = 50,000 Canton Coin

VALIDATION:
Server recalculates and compares:
- Tolerance: 1% difference allowed
- If |client_value - server_value| > 1%:
  → Reject as "Invalid exchange rate calculation"

REASON:
Prevents client-side manipulation
```

---

### **Rule 2: Order Amount Limits**

```typescript
CONSTRAINTS:
MIN_USDT_AMOUNT = 50    // Minimum $50
MAX_USDT_AMOUNT = 50000 // Maximum $50,000

RATIONALE:
- Minimum: Cover network fees + administrative cost
- Maximum: Liquidity management + AML compliance

ENFORCEMENT:
1. Frontend: Real-time validation + toast errors
2. Backend: Reject orders outside range
3. Error messages:
   - "Minimum order amount is $50"
   - "Maximum order amount is $50,000"

EDGE CASES:
$49.99 → Rejected
$50.00 → Accepted ✅
$50,000.00 → Accepted ✅
$50,000.01 → Rejected
```

---

### **Rule 3: Business Hours**

```typescript
DEFINITION:
BUSINESS_HOURS = "8:00 AM - 10:00 PM (GMT+3)"

BEHAVIOR:
- Orders: Accepted 24/7
- Processing: Only during business hours
- Response time:
  ├─ Business hours: 15-120 minutes
  └─ Outside hours: Next business day

DISPLAY:
Frontend indicator:
🟢 "We are available daily from 8:00 AM - 10:00 PM (GMT+3)"

EMAIL:
"⏰ Обработка в рабочие часы: 8:00 AM - 10:00 PM (GMT+3)"

ADMIN:
Process orders during hours, queue overnight orders
```

---

### **Rule 4: Payment Verification**

```typescript
VERIFICATION CHECKLIST:
✓ Amount matches order (exact or higher)
✓ Token = USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)
✓ Network = TRON (TRC-20)
✓ Receiving address = OTC_CONFIG.USDT_RECEIVING_ADDRESS
✓ Confirmations >= 19 blocks
✓ Transaction status = Success
✓ Within reasonable timeframe (< 24h)

OVERPAYMENT:
If user sends MORE than required:
- Accept payment
- Send only ordered Canton amount
- Notify user of overpayment
- Offer refund of difference OR credit

UNDERPAYMENT:
If user sends LESS than required:
- Contact user
- Options:
  a) Send remaining amount
  b) Reduce Canton amount proportionally
  c) Refund to refund address

WRONG TOKEN:
If user sends TRX instead of USDT:
- Cannot process
- Refund TRX to sender
- Ask to resend correct token
```

---

### **Rule 5: Refund Policy**

```typescript
REFUND SCENARIOS:

1. Order Cancelled (before payment):
   - No refund needed
   - Status: cancelled

2. Payment Timeout (no payment received):
   - No refund needed
   - Order expires after 24h

3. Service Issue (cannot deliver Canton):
   - Full USDT refund
   - Sent to refundAddress (if provided)
   - OR contact user for address
   - Minus network fees (disclosed)

4. Wrong Payment:
   - Refund wrong token/amount
   - User pays return network fees
   - Request correct payment

5. Duplicate Payment:
   - Refund duplicate
   - Process original order

REFUND PROCESS:
1. Admin verifies issue
2. Updates status: "failed"
3. Initiates USDT return:
   - To: order.refundAddress OR order.email (request)
   - Amount: Original - fees
   - Network: TRC-20
4. Sends TX hash to user
5. Updates Google Sheets
6. Email notification

TIMEFRAME:
Business hours: 1-4 hours
Outside hours: Next business day
```

---

## 🎭 EDGE CASES & SPECIAL SCENARIOS

### **Edge Case 1: Concurrent Orders (Same User)**

```
User creates 2 orders simultaneously:

Order A (15:00:00.100):
├─ IP: 95.123.45.67
├─ Email: user@example.com
└─ Rate check: 0/3 → 1/3 ✅

Order B (15:00:00.200):
├─ IP: 95.123.45.67
├─ Email: user@example.com
└─ Rate check: 1/3 → 2/3 ✅

Both accepted because:
- Different timestamps (no duplicate)
- Within rate limits
- Independent Order IDs

Duplicate Detection:
If identical amounts + addresses within 10min:
→ Marked as duplicate (Score +40)
→ May trigger spam detection
```

---

### **Edge Case 2: Exactly 50,000 USDT (Maximum)**

```
User: $50,000 USDT (exactly)

Validation:
├─ MIN_USDT_AMOUNT (50): ✅
├─ MAX_USDT_AMOUNT (50000): ✅ (inclusive)
├─ Calculate: 50000 / 0.20 = 250,000 Canton Coin
└─ Result: Accepted ✅

Special handling:
- Large order flag (admin review)
- May require KYC (future)
- Split into multiple transactions (liquidity)
```

---

### **Edge Case 3: Refund Address = Canton Address**

```
User provides:
├─ cantonAddress: "canton1abc..."
└─ refundAddress: "canton1abc..." (same)

Validation:
├─ Both valid Canton addresses ✅
├─ Both accepted
└─ No error (legitimate use case)

Behavior:
If refund needed:
- Send to same address as delivery
- Simplifies process
```

---

### **Edge Case 4: No Email Received**

```
User: "I didn't receive confirmation email!"

Possible causes:
1. Spam folder
2. Email service down (at time of order)
3. Invalid email address
4. Email server rejection

Admin actions:
1. Check Google Sheets:
   - Order exists? ✅
   - Email address correct?
2. Check logs:
   - Email service status at time?
3. Resend email manually
4. Or provide order details via support

Prevention:
- Show Order ID on screen (copy)
- Toast confirmation
- Multiple contact methods (WhatsApp, Telegram)
```

---

## 🔍 TRACKING & MONITORING

### **Admin Dashboard (Google Sheets)**

```
Sheet: "Orders"

Columns:
A: Order ID          - Unique identifier
B: Timestamp         - ISO 8601 format
C: USDT Amount       - Number
D: Canton Amount     - Number
E: Canton Address    - String (validated)
F: Refund Address    - String (optional)
G: Email            - String (lowercase)
H: WhatsApp         - String (optional)
I: Telegram         - String (optional)
J: Status           - Enum (order status)
K: TX Hash          - String (Canton transaction)
L: Created At       - Formatted date GMT+3

Features:
├─ Sort by timestamp (newest first)
├─ Filter by status
├─ Search by Order ID
├─ Export to CSV
└─ Conditional formatting:
   ├─ Green: completed
   ├─ Orange: awaiting-deposit
   ├─ Blue: awaiting-confirmation
   ├─ Yellow: exchanging
   ├─ Green: sending
   └─ Red: failed

Analytics:
├─ SUM(USDT Amount) = Total volume
├─ COUNT(Status=completed) = Success rate
├─ AVG(Time to complete) = Performance
└─ COUNT by day = Order frequency
```

---

### **Order Status Tracking (Customer)**

```
URL: /api/order-status/[orderId]

Example: GET /api/order-status/L9X2K-ABCD12

Response:
{
  "success": true,
  "order": {
    "orderId": "L9X2K-ABCD12",
    "timestamp": "2025-10-08T12:30:00.000Z",
    "usdtAmount": 2000,
    "cantonAmount": 10000,
    "status": "sending",
    "cantonAddress": "canton1...",
    "email": "ivan@example.com"
  },
  "progress": {
    "current": 4,
    "total": 5,
    "percentage": 80
  },
  "estimatedCompletion": "15-30 minutes",
  "nextSteps": [
    "Transferring Canton Coin to your address",
    "Transaction is being processed",
    "You will receive confirmation shortly"
  ]
}

UI Display:
┌─────────────────────────────────────────┐
│ Order Status: L9X2K-ABCD12              │
├─────────────────────────────────────────┤
│ Progress: ████████░░ 80%                │
│                                         │
│ Status: 🟢 Sending to you               │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ ✓ Awaiting deposit                │  │
│ │ ✓ Awaiting confirmation           │  │
│ │ ✓ Exchanging                      │  │
│ │ → Sending to you                  │  │
│ │   Done                            │  │
│ └───────────────────────────────────┘  │
│                                         │
│ Next Steps:                             │
│ • Transferring Canton Coin...          │
│ • Transaction is being processed       │
│ • You will receive confirmation        │
│                                         │
│ Est. completion: 15-30 minutes         │
└─────────────────────────────────────────┘
```

---

## 📈 SUCCESS METRICS

```
KPIs to Track:

1. Conversion Rate:
   Formula: (Completed Orders / Total Orders) * 100
   Target: >95%

2. Average Processing Time:
   Formula: AVG(Completed Time - Created Time)
   Target: <2 hours (during business hours)

3. Payment Success Rate:
   Formula: (Orders with Valid Payment / Total Orders) * 100
   Target: >98%

4. Customer Satisfaction:
   - Email responses
   - Support ticket resolution time
   - Repeat customer rate

5. System Uptime:
   - API availability: >99.9%
   - Service integration success: >99%

6. Security Metrics:
   - Spam blocked: Track false positives/negatives
   - Rate limit violations: Monitor patterns
   - Failed validations: Analyze causes

7. Business Metrics:
   - Total volume (USDT)
   - Total Canton distributed
   - Average order size
   - Revenue per order
```

---

**КОНЕЦ ДОКУМЕНТА**

Это полное описание всех user stories, бизнес-логики, state машин и edge cases для Canton OTC Exchange.



