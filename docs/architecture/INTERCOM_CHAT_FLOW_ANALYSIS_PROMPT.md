# 🔍 COMPREHENSIVE INTERCOM CHAT FLOW ANALYSIS PROMPT
**Canton OTC Exchange - Post-Order Customer-Admin Communication System**

---

## 📋 MAIN OBJECTIVE

Analyze the complete customer-admin communication flow that occurs AFTER order creation in the Canton OTC Exchange system. Focus on the integration between Intercom chat, Telegram mediator, AI agents, and admin responses through multiple channels.

---

## 🎯 SPECIFIC AREAS TO ANALYZE

### 1. **POST-ORDER NOTIFICATION SYSTEM**
```typescript
// Location: src/app/api/create-order/route.ts → processOrderAsync()
```
**Analyze:**
- How order notifications are sent to Intercom, Telegram, and Google Sheets
- IntercomService.sendOrderNotification() - conversation creation process
- TelegramService.sendOrderNotification() - operator group notifications with inline buttons
- Integration between services and error handling

**Key Questions:**
- How is the initial Intercom conversation created with order context?
- What data is attached to the Intercom user profile?
- How do inline buttons in Telegram notifications work?

---

### 2. **CLIENT INTERCOM CHAT INTEGRATION**
```typescript
// Location: src/components/OrderSummary.tsx
```
**Analyze:**
- "Contact Customer Support" button functionality
- intercomUtils.showNewMessage() with pre-filled order details
- intercomUtils.updateUser() with order context
- intercomUtils.trackEvent() for analytics

**Key Questions:**
- How is the order number automatically passed to the chat?
- What happens when client clicks the support button?
- How is user context updated in Intercom?

---

### 3. **INTERCOM WEBHOOK SYSTEM**
```typescript
// Location: src/app/api/intercom/webhook/route.ts
```
**Analyze:**
- Webhook security (HMAC verification)
- Rate limiting implementation
- Message processing flow: AI Agent → Human Operator
- Integration with telegramMediatorService

**Flow to Analyze:**
1. Client sends message in Intercom
2. Webhook receives payload
3. AI Agent attempts to process
4. If AI can't handle → forward to Telegram operators
5. Context preservation and storage

---

### 4. **AI AGENT PROCESSING**
```typescript
// Location: src/lib/services/intercomAIAgent.ts
```
**Analyze:**
- processMessage() logic and intent analysis
- Automatic order creation capability
- transferToHuman() functionality
- Integration with multiple AI systems (standard + Fin over API)

**Key Features:**
- Intent recognition (buy_canton, check_price, order_status, support)
- Automatic order creation flow
- Human handoff process
- Response generation and formatting

---

### 5. **TELEGRAM MEDIATOR SYSTEM**
```typescript
// Location: src/lib/services/telegramMediator.ts
```
**Analyze:**
- forwardClientMessage() - client → operator forwarding
- Conversation context storage in Redis
- Inline keyboard for operator responses
- Bidirectional communication flow

**Critical Components:**
- ConversationStorage integration
- Message formatting with order context
- Operator response handling via callbacks
- Context preservation across sessions

---

### 6. **ADMIN RESPONSE MECHANISMS**

**Multiple Admin Response Channels:**

#### A) **Intercom Admin Dashboard** (Direct)
- Admin responds directly in Intercom interface
- No additional API integration needed
- Direct client communication

#### B) **Telegram Bot Responses**
```typescript
// Location: src/app/api/telegram-mediator/webhook/route.ts
```
- Callback button handling ("💬 Ответить клиенту")
- Context retrieval from conversationStorage
- Response forwarding back to Intercom via API

#### C) **AI Agent Auto-Responses**
- Automatic responses for common queries
- Order status updates
- Payment instructions
- Human handoff when needed

---

### 7. **CONVERSATION STORAGE SYSTEM**
```typescript
// Location: src/lib/services/conversationStorage.ts
```
**Analyze:**
- Redis-based context persistence
- Order ID ↔ Intercom Conversation ID mapping
- Customer data preservation
- Context retrieval for admin responses

**Data Structure:**
```typescript
interface ConversationContext {
  orderId: string
  customerEmail: string
  orderAmount?: number
  orderStatus?: string
  cantonAddress?: string
  refundAddress?: string
  intercomConversationId?: string
  intercomUserId?: string
  createdAt: number
  updatedAt: number
  lastActivity: number
}
```

---

### 8. **FIN OVER API INTEGRATION**
```typescript
// Location: src/app/api/intercom/fin-over-api/route.ts
```
**Analyze:**
- Alternative AI system integration
- Event handling (new_conversation, new_message, quick_reply_selected)
- Quick reply options and user flow
- Integration with main system

---

## 🔧 TECHNICAL ARCHITECTURE ANALYSIS

### **Flow Diagram to Understand:**
```
ORDER CREATED
    ↓
┌─────────────────────────────────────────────────────────┐
│ 1. NOTIFICATIONS SENT                                   │
│ • Intercom: Create conversation + user data            │
│ • Telegram: Operator group notification + buttons      │
│ • Google Sheets: Save order data                       │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ 2. CLIENT CLICKS "CONTACT CUSTOMER SUPPORT"            │
│ • Open Intercom chat with pre-filled message           │
│ • Pass order ID and details                            │
│ • Update user context in Intercom                      │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ 3. CLIENT SENDS MESSAGE IN INTERCOM                    │
│ • Intercom webhook → /api/intercom/webhook             │
│ • Rate limiting check                                   │
│ • Security verification (HMAC)                         │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ 4. AI AGENT PROCESSING                                  │
│ • Try to handle automatically                           │
│ • Can create orders, check status, provide info        │
│ • If can't handle → transfer to human                   │
└─────────────────────────────────────────────────────────┘
    ↓ (if human needed)
┌─────────────────────────────────────────────────────────┐
│ 5. TELEGRAM MEDIATOR FORWARDING                        │
│ • Format message with order context                     │
│ • Send to operator Telegram group                      │
│ • Save conversation context to Redis                   │
│ • Add "Reply" button for operator                      │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│ 6. ADMIN RESPONSE OPTIONS                               │
│ A) Intercom Dashboard (direct response)                │
│ B) Telegram Bot ("Reply" button)                       │
│    • Callback → /api/telegram-mediator/webhook         │
│    • Retrieve context from Redis                       │
│    • Send reply to Intercom via API                    │
│ C) AI Agent (automatic responses)                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 KEY INTEGRATION POINTS TO ANALYZE

### **1. Data Flow Integration:**
- Order ID propagation through all systems
- User context preservation
- Message threading and conversation continuity

### **2. Error Handling & Fallbacks:**
- What happens if Intercom is down?
- How are failed message deliveries handled?
- Fallback to alternative communication channels

### **3. Security & Rate Limiting:**
- Webhook signature verification
- Redis-based rate limiting
- Admin authentication and authorization

### **4. Monitoring & Analytics:**
- intercomMonitoringService integration
- Event tracking and metrics
- Performance monitoring across services

---

## 📊 ANALYSIS DELIVERABLES EXPECTED

### **1. ARCHITECTURE DIAGRAM:**
- Complete communication flow visualization
- Integration points between systems
- Data flow and context preservation

### **2. TECHNICAL ASSESSMENT:**
- Code quality and best practices analysis
- Potential bottlenecks and performance issues
- Security vulnerabilities assessment

### **3. IMPROVEMENT RECOMMENDATIONS:**
- Optimization opportunities
- Missing features or functionality gaps
- Scalability considerations

### **4. INTEGRATION ANALYSIS:**
- How well do systems work together?
- Are there redundant or conflicting processes?
- Data consistency across services

---

## 🔍 SPECIFIC FILES TO ANALYZE

**Core Communication Flow:**
- `src/app/api/create-order/route.ts` (processOrderAsync)
- `src/components/OrderSummary.tsx` (Contact Support button)
- `src/app/api/intercom/webhook/route.ts` (webhook handling)
- `src/lib/services/intercomAIAgent.ts` (AI processing)
- `src/lib/services/telegramMediator.ts` (message forwarding)
- `src/lib/services/conversationStorage.ts` (context persistence)

**Supporting Systems:**
- `src/lib/services/intercom.ts` (Intercom API integration)
- `src/lib/services/telegram.ts` (Telegram notifications)
- `src/app/api/telegram-mediator/webhook/route.ts` (admin responses)
- `src/app/api/intercom/fin-over-api/route.ts` (alternative AI)
- `src/lib/services/intercomMonitoring.ts` (monitoring)

**Configuration & Utils:**
- `src/components/IntercomProvider.tsx` (client-side integration)
- Environment variables and API keys setup
- Redis configuration for conversation storage

---

## ❓ KEY QUESTIONS TO ANSWER

1. **How seamless is the handoff from order creation to customer support?**
2. **Can admins efficiently manage multiple customer conversations?**  
3. **How effective is the AI agent at reducing admin workload?**
4. **What happens to conversation context if systems restart?**
5. **How well does the system scale with increased message volume?**
6. **Are there any message delivery failures or lost conversations?**
7. **How secure is the webhook system against attacks?**
8. **What monitoring and alerting exists for system health?**

---

## 🚀 EXPECTED OUTCOME

A comprehensive analysis that provides:
- **Complete understanding** of post-order communication flow
- **Technical assessment** of all integration points  
- **Actionable recommendations** for improvements
- **Performance and security** evaluation
- **Scalability planning** for future growth

---

**Focus on real-world usage scenarios and ensure the system provides excellent customer experience while being manageable for admins.**






