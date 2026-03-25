# 🏗️ Профессиональный Промт для Архитектурного Анализа и Рефакторинга
## Canton OTC - Enterprise-level Architecture Analysis

*Создан на основе best practices промт инжиниринга 2025*

---

## 🎯 ГЛАВНАЯ ЗАДАЧА

Выступая в роли **Senior Solution Architect** с экспертизой в enterprise Next.js системах, blockchain интеграциях и финансовых платформах, проведите **глубокий многоуровневый анализ** проекта Canton OTC для выявления архитектурных улучшений и возможностей рефакторинга.

**КРИТИЧЕСКИ ВАЖНО**: Все предложенные изменения должны:
- ✅ Сохранить 100% текущей функциональности
- ✅ Соответствовать бизнес-логике OTC обмена
- ✅ Поддерживать все существующие интеграции
- ✅ Следовать принципам Clean Architecture
- ✅ Быть готовыми к production deployment

---

## 🔍 МЕТОДОЛОГИЯ АНАЛИЗА

### Phase 1: Chain-of-Thought Architecture Analysis
Используйте пошаговый анализ для понимания:

1. **Текущая архитектурная топология**
   - Изучите структуру Next.js App Router (28+ API endpoints)
   - Проанализируйте 15+ сервисов в `src/lib/services/`
   - Оцените систему управления конфигурацией (ConfigManager)
   - Исследуйте централизованную обработку ошибок (ErrorHandler)

2. **Бизнес-критические потоки**
   - Order Creation & Processing Pipeline
   - Multi-blockchain payment processing (Ethereum, TRON, Solana, Optimism)
   - Dynamic pricing & discount system
   - AI Agent integration (Intercom)
   - Admin monitoring & management

3. **Система интеграций**
   - Google Sheets storage
   - Telegram Bot & Mediator
   - GitHub API & Secrets Management
   - Redis caching & rate limiting
   - Email services & notifications

### Phase 2: Self-Refinement Quality Check
После каждого предложения по улучшению:
- Оцените риски и побочные эффекты
- Проверьте совместимость с существующей логикой
- Рассмотрите альтернативные подходы
- Убедитесь в соответствии enterprise стандартам

### Phase 3: Structured Output Formatting
Представьте результаты в четко структурированном формате с приоритизацией.

---

## 📋 СТРУКТУРА АНАЛИЗА

### 1. EXECUTIVE SUMMARY
```
[Краткое резюме состояния архитектуры]
- Общая оценка зрелости системы (1-10)
- Топ-3 критичных области для улучшения
- Приоритетность изменений (High/Medium/Low)
- Оценка сложности рефакторинга
```

### 2. АРХИТЕКТУРНЫЕ ПАТТЕРНЫ И НАРУШЕНИЯ

#### 2.1 Domain Layer Analysis
```
ТЕКУЩЕЕ СОСТОЯНИЕ:
- [Анализ доменной логики]
- [Выявление нарушений принципов DDD]

ПРЕДЛОЖЕНИЯ:
- [Конкретные улучшения с примерами кода]
- [Новые доменные сервисы]
```

#### 2.2 Service Layer Architecture
```
ПРОБЛЕМЫ:
- [Анализ 15+ сервисов в /lib/services/]
- [Выявление тесно связанных компонентов]
- [Проблемы с разделением ответственности]

РЕШЕНИЯ:
- [Предложения по реорганизации сервисов]
- [Новые абстракции и интерфейсы]
```

#### 2.3 API Layer Organization
```
АНАЛИЗ 28+ ENDPOINTS:
/api/admin/* - [Анализ административных endpoints]
/api/intercom/* - [AI Agent и webhook логика]  
/api/auth/* - [Аутентификация]
/api/config/* - [Управление конфигурацией]

РЕФАКТОРИНГ:
- [Группировка по доменам]
- [Выделение общих middleware]
- [Оптимизация routing]
```

### 3. КАЧЕСТВО КОДА И ТЕХНИЧЕСКАЯ ЗАДОЛЖЕННОСТЬ

#### 3.1 Error Handling & Validation
```
ТЕКУЩИЙ ERRORHANDLER:
✅ Плюсы: [что работает хорошо]
❌ Минусы: [что требует улучшения]

ВАЛИДАЦИЯ:
✅ Плюсы: [анализ validators.ts]
❌ Минусы: [области для улучшения]
```

#### 3.2 Configuration Management
```
CONFIGMANAGER АНАЛИЗ:
- [Оценка сложности текущей системы]
- [Потенциальные циклические зависимости]
- [Производительность auto-refresh механизма]

УЛУЧШЕНИЯ:
- [Упрощение архитектуры]
- [Лучшие паттерны для конфигурации]
```

### 4. PERFORMANCE & SCALABILITY

#### 4.1 Система кеширования
```
REDIS USAGE ANALYSIS:
- [Эффективность текущего кеширования]
- [Bottleneck'и в rate limiting]

ОПТИМИЗАЦИИ:
- [Стратегии улучшения кеширования]
```

#### 4.2 Database & External Services
```
GOOGLE SHEETS INTEGRATION:
- [Анализ производительности]
- [Риски и ограничения]

АЛЬТЕРНАТИВЫ:
- [Предложения по улучшению data layer]
```

### 5. БЕЗОПАСНОСТЬ И COMPLIANCE

#### 5.1 Security Architecture Review
```
ТЕКУЩИЕ МЕРЫ:
- Rate limiting implementation
- GitHub Secrets management  
- Input validation & sanitization
- Authentication flows

УЛУЧШЕНИЯ:
- [Конкретные рекомендации по безопасности]
```

### 6. ПЛАН РЕФАКТОРИНГА

#### 6.1 Фазированный подход
```
PHASE 1 (Критичный - 1-2 недели):
□ [Высокоприоритетные изменения]
□ [Исправления критичных architectural flaws]

PHASE 2 (Важный - 3-4 недели):  
□ [Средние улучшения]
□ [Оптимизация производительности]

PHASE 3 (Полезный - 5-8 недель):
□ [Nice-to-have улучшения]
□ [Долгосрочные архитектурные изменения]
```

#### 6.2 Риски и миграционная стратегия
```
ВЫСОКИЕ РИСКИ:
- [Потенциальные breaking changes]
- [Зависимости от внешних сервисов]

СТРАТЕГИЯ МИНИМИЗАЦИИ:
- [Feature flags]
- [Gradual rollout]
- [Rollback планы]
```

---

## 🎯 СПЕЦИФИЧЕСКИЕ ТРЕБОВАНИЯ ДЛЯ АНАЛИЗА

### Blockchain & Crypto Considerations
- Анализ multi-chain support (Ethereum, TRON, Solana, Optimism)
- Безопасность private key management
- Transaction monitoring & reconciliation

### Financial Services Requirements  
- Audit trail completeness
- Compliance с финансовыми регулированиями
- Anti-fraud mechanisms
- KYC/AML considerations

### AI Integration Analysis
- Intercom AI Agent архитектура
- Conversation management
- Fin over API implementation

### DevOps & Infrastructure
- Kubernetes deployment optimization
- CI/CD pipeline improvements
- Monitoring & alerting enhancements

---

## ✅ ACCEPTANCE CRITERIA

Ваш анализ считается завершенным когда:

1. **Полнота анализа**: Покрыты все критичные компоненты системы
2. **Практичность предложений**: Каждое предложение имеет конкретный план реализации
3. **Безопасность изменений**: Гарантии сохранения функциональности
4. **Бизнес-аligment**: Соответствие OTC бизнес-процессам
5. **Production-readiness**: Готовность к enterprise развертыванию

---

## 🚀 НАЧНИТЕ АНАЛИЗ

**Первый шаг**: Изучите структуру проекта и определите 3 самые критичные области для улучшения.

**Помните**: Цель не в том чтобы переписать систему, а в том чтобы сделать её **чище, надежнее и maintainable**, сохранив при этом все существующие возможности и бизнес-процессы Canton OTC.

---

*Этот промт создан с использованием advanced prompt engineering techniques 2025: Chain-of-Thought reasoning, Self-Refinement validation, и Structured Output formatting для максимально эффективного архитектурного анализа enterprise-level систем.*
