# Обращение к SV Sponsor - TestNet и MainNet

**Дата**: 2025-11-29  
**Тема**: Request for TestNet IP Whitelisting and MainNet Onboarding Secret

---

## 📧 Основное обращение (Main Letter)

```
Subject: Request for TestNet IP Whitelisting and MainNet Onboarding Secret

Dear [SV Sponsor Name],

We represent a community of Canton Network enthusiasts who are actively exploring and developing innovative solutions on the Canton Network. We have successfully deployed a DevNet validator node using Docker Compose to familiarize ourselves with the Canton infrastructure, upgraded to the latest version (0.5.3), and are currently researching integration with decentralized applications.

To accelerate our transition from DevNet to TestNet and MainNet, we need your assistance with the following:

---

**1. TestNet IP Whitelisting**

**IP Address**: 65.108.15.20
**Network**: TestNet
**Status**: 
- ✅ IP address is correctly configured and routing properly
- ❌ IP is not yet in SV allowlist (Scan/Sequencer APIs timeout)
- ⏳ Awaiting allowlist update (expected 2-7 days)

**Request**: Please add IP 65.108.15.20 to the TestNet allowlist maintained by Super Validators.

**Validation Details**:
- IP address correctly identified: 65.108.15.20
- IP address found on network interface
- Routing confirmed: curl --interface 65.108.15.20 → returns correct IP
- Current issue: Connection timeout to Scan/Sequencer APIs (indicates IP not in whitelist)

---

**2. MainNet Onboarding Secret**

**IP Address**: 65.108.15.19
**Network**: MainNet
**Status**: 
- ✅ IP address is fully validated
- ✅ 15 Sequencer endpoints accessible (exceeds minimum of 14)
- ✅ Scan API accessible
- ✅ IP is in SV allowlist
- ⏳ Awaiting onboarding secret for deployment

**Request**: Please provide MainNet onboarding secret for IP 65.108.15.19.

**Validation Results**:
- ✅ IP address correctly identified: 65.108.15.19
- ✅ IP address found on network interface
- ✅ Routing confirmed: curl --interface 65.108.15.19 → returns correct IP
- ✅ Scan API: Successfully connected
- ✅ Sequencer API: Accessible
- ✅ Found 15 Sequencer endpoints (exceeds minimum requirement of 14)

**Validation completed**: 2025-11-29 12:34:18

---

**Current Setup:**
- **DevNet** (65.108.15.30): ✅ Deployed and operational (Docker Compose)
- **TestNet** (65.108.15.20): ⏳ Awaiting IP whitelisting
- **MainNet** (65.108.15.19): ✅ Validated, awaiting onboarding secret

**Technical Details:**
- **Canton Version**: 0.5.3 (latest)
- **Server**: canton-node-65-108-15-30
- **Deployment Method**: Docker Compose (DevNet), Kubernetes ready (TestNet/MainNet)

---

**Our Goals:**
- Continue learning and experimenting on DevNet
- Transition to TestNet for production-like testing
- Deploy to MainNet to contribute to the Canton Network ecosystem
- Develop innovative decentralized applications on Canton Network

**Timeline:**
We are ready to deploy immediately upon:
1. TestNet: IP whitelisting completion (2-7 days expected)
2. MainNet: Receiving onboarding secret (ready now)

We understand that:
- TestNet IP whitelisting typically takes 2-7 days for all SVs to update
- MainNet onboarding secret is valid for 48 hours and single-use
- We are prepared to deploy immediately upon receiving the MainNet secret

Please let me know if you need any additional information or documentation.

Thank you for your support in helping our community contribute to the Canton Network.

Best regards,

[Your Name]
[Your Organization/Community]
[Email]
[Phone (optional)]
```

---

## 📧 Краткая версия (Short Version)

```
Subject: Request for TestNet IP Whitelisting and MainNet Onboarding Secret

Dear [SV Sponsor Name],

We represent a community of Canton Network enthusiasts. We have successfully deployed a DevNet validator (Docker Compose, Canton 0.5.3) and are researching integration with decentralized applications to develop innovative solutions on Canton Network.

To accelerate our transition to TestNet and MainNet, we need:

1. **TestNet IP Whitelisting**: Please add IP 65.108.15.20 to TestNet allowlist.
   - Status: IP configured correctly, awaiting allowlist update

2. **MainNet Onboarding Secret**: Please provide onboarding secret for IP 65.108.15.19.
   - Status: IP fully validated (15 Sequencer endpoints), ready for deployment

**Validator Information:**
- MainNet IP: 65.108.15.19 (fully validated)
- TestNet IP: 65.108.15.20 (configured, awaiting whitelisting)
- DevNet: ✅ Operational (65.108.15.30)
- Canton Version: 0.5.3

We are ready to deploy immediately upon receiving the MainNet secret.

Thank you for your support.

Best regards,
[Your Name]
[Your Community/Organization]
[Contact Information]
```

---

## 📋 Ключевые пункты для включения

### О нас (About Us):
- ✅ Community of Canton Network enthusiasts
- ✅ Successfully deployed DevNet validator (Docker Compose)
- ✅ Upgraded to latest version (0.5.3)
- ✅ Researching integration with decentralized applications
- ✅ Developing innovative solutions on Canton Network

### Проблемы (Issues to Solve):

1. **TestNet IP Whitelisting**
   - IP: 65.108.15.20
   - Problem: Not in SV allowlist
   - Solution: Add to TestNet allowlist
   - Timeline: 2-7 days expected

2. **MainNet Onboarding Secret**
   - IP: 65.108.15.19
   - Problem: Need onboarding secret
   - Solution: Provide MainNet onboarding secret
   - Status: IP fully validated, ready now

### Текущий статус (Current Status):
- DevNet: ✅ Operational
- TestNet: ⏳ Awaiting whitelisting
- MainNet: ⏳ Awaiting secret

---

## 🎯 Рекомендации по отправке

1. **Выбрать версию**: Основная (подробная) или краткая
2. **Заполнить поля**: 
   - [SV Sponsor Name] - имя вашего SV sponsor
   - [Your Name] - ваше имя
   - [Your Organization/Community] - название сообщества/организации
   - [Contact Information] - email, телефон (опционально)
3. **Приложить документы** (опционально):
   - `TESTNET_MAINNET_VALIDATION_REPORT.md` - отчет о валидации
   - `CANTON_NETWORKS_COMPLETE_REPORT.md` - общий отчет
4. **Отправить**: На email SV sponsor или через официальные каналы

---

## 📞 Альтернативные способы связи

Если у вас нет прямого контакта SV sponsor:

1. **Canton Foundation Operations**: operations@sync.global
2. **Validator Request Form**: https://canton.foundation/validator-request/
3. **Slack**: #validator-operations channel
4. **List of Super Validators**: https://canton.foundation/validators/

---

**Последнее обновление**: 2025-11-29





