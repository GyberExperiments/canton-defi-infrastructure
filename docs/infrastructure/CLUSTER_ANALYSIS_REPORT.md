# 📊 ОТЧЕТ ПО АНАЛИЗУ KUBERNETES КЛАСТЕРА

## 🔍 ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ

### 1. КОНФЛИКТ INGRESS CONTROLLERS ⚠️ КРИТИЧНО

**Проблема:**
- В кластере установлен только **Traefik** (`ingressClassName: traefik`)
- Но 11 ingress используют **Istio** (не установлен/не работает)
- 1 ingress использует **Nginx** (не установлен/не работает)

**Найденные проблемные ingress:**
```
default/auradomus-acme-challenge: istio
default/cm-acme-http-solver-sdtzg: istio
develop-gprod/cm-acme-http-solver-hql28: istio
istio-system/cm-acme-http-solver-*: istio (5 штук)
prod-pswmeta/cm-acme-http-solver-ncgkf: istio
stage-pswmeta/cm-acme-http-solver-nl9d5: istio
supabase/supabase-ingress: nginx
```

**Корневая причина:**
- Проекты создавали ingress конфигурации с использованием несуществующих ingress controllers
- Cert-manager автоматически создавал Certificate и Challenge для этих ingress
- Challenge поды не могли быть запланированы (нет подходящего ingress controller)
- Cert-manager продолжал создавать новые Challenge, старые не удалялись
- Накопление тысяч Pending подов

**Исправлено:**
- ✅ `canton-otc/k8s/supabase/ingress.yaml`: nginx → traefik
- ✅ `aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml`: istio → traefik

**Требуется:**
- Исправить остальные ingress конфигурации в проектах
- Удалить проблемные ingress из кластера

### 2. РАЗНООБРАЗИЕ CLUSTERISSUER ⚠️

**Проблема:**
- В кластере 3 разных ClusterIssuer:
  - `letsencrypt-prod` (используется большинством)
  - `letsencrypt-production` (используется некоторыми проектами)
  - `letsencrypt-staging` (используется для stage окружений)

**Использование:**
- `letsencrypt-prod`: canton-otc, maximus, DSP, tech-hy-ecosystem
- `letsencrypt-production`: multi-swarm-system, aura-domus, GPROD
- `letsencrypt-staging`: multi-swarm-system (stage)

**Рекомендация:**
- Унифицировать на `letsencrypt-prod` для production
- Использовать `letsencrypt-staging` для stage окружений
- Удалить `letsencrypt-production` (слишком похож на prod, может вызывать путаницу)

### 3. АВТОМАТИЧЕСКОЕ СОЗДАНИЕ CERTIFICATE ⚠️

**Проблема:**
- Все ingress с аннотацией `cert-manager.io/cluster-issuer` автоматически создают Certificate ресурсы
- Нет явного управления Certificate ресурсами
- Certificate создаются даже для неработающих ingress

**Текущее состояние:**
- 27 Certificate ресурсов в кластере
- Множество Challenges в статусе `pending`
- Особенно проблемные для istio ingress

**Рекомендация:**
- Использовать явное создание Certificate ресурсов
- Удалить аннотацию `cert-manager.io/cluster-issuer` из ingress
- Создавать Certificate ресурсы отдельно

### 4. КОНФИГУРАЦИЯ CERT-MANAGER ⚠️

**Проблема:**
- Cert-manager создает слишком много одновременных Challenge
- Нет ограничений на количество solver подов
- Нет автоматической очистки старых подов

**Рекомендация:**
```yaml
args:
  - --max-concurrent-challenges=5
  - --acme-http01-solver-pod-grace-period=1m
  - --enable-certificate-owner-ref=true
```

---

## 📋 НАЙДЕННЫЕ ПРОТИВОРЕЧИЯ В ПРОЕКТАХ

### Проекты с проблемными ingress:

1. **canton-otc/k8s/supabase/ingress.yaml**
   - ❌ Использовал `nginx` вместо `traefik`
   - ✅ Исправлено

2. **aura-domus/k8s/overlays/prod/auradomus-acme-ingress.yml**
   - ❌ Использовал `istio` вместо `traefik`
   - ❌ Использовал `letsencrypt-production` вместо `letsencrypt-prod`
   - ✅ Исправлено

3. **Другие проекты** (требуют проверки):
   - `TECHHY_PROJECTS/open-router-telegram-wrapper`: использует nginx
   - `TRADER-AGENT`: несколько ingress с nginx
   - `multi-swarm-system`: использует разные ingress controllers для prod/stage

### Проекты с разными ClusterIssuer:

1. **multi-swarm-system**: использует `letsencrypt-production` для prod, `letsencrypt-staging` для stage
2. **aura-domus**: использует `letsencrypt-production`
3. **GPROD**: использует `letsencrypt-production`
4. **dev-ops/pswmeta-game-tg-app-backend**: использует `letsencrypt-production`

---

## 🎯 ПЛАН ДЕЙСТВИЙ

### Приоритет 1: КРИТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ

1. ✅ Создан план восстановления (`CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md`)
2. ✅ Создан скрипт критического восстановления (`scripts/cluster-recovery-critical.sh`)
3. ✅ Исправлены проблемные ingress конфигурации (supabase, aura-domus)
4. ⏳ Выполнить скрипт критического восстановления
5. ⏳ Исправить остальные ingress конфигурации

### Приоритет 2: УНИФИКАЦИЯ

1. ⏳ Унифицировать ClusterIssuer (все на `letsencrypt-prod` или `letsencrypt-staging`)
2. ⏳ Обновить все ingress конфигурации
3. ⏳ Создать явные Certificate ресурсы вместо автоматических

### Приоритет 3: ОПТИМИЗАЦИЯ

1. ⏳ Настроить правильную конфигурацию cert-manager
2. ⏳ Создать скрипты для регулярной очистки
3. ⏳ Настроить мониторинг

---

## 📝 СОЗДАННЫЕ ФАЙЛЫ

1. **CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md** - Полный план восстановления и организации
2. **CLUSTER_ANALYSIS_REPORT.md** - Этот отчет
3. **scripts/cluster-recovery-critical.sh** - Скрипт критического восстановления
4. **scripts/fix-ingress-configurations.sh** - Скрипт для исправления ingress конфигураций

---

## 🚀 СЛЕДУЮЩИЕ ШАГИ

1. **Выполнить критическое восстановление:**
   ```bash
   ./scripts/cluster-recovery-critical.sh
   ```

2. **Исправить ingress конфигурации:**
   ```bash
   ./scripts/fix-ingress-configurations.sh
   ```

3. **Настроить cert-manager:**
   - Применить правильную конфигурацию
   - Перезапустить cert-manager

4. **Проверить восстановление:**
   - Проверить количество Pending подов
   - Проверить статус Certificate
   - Проверить нагрузку на control-plane

---

**ВАЖНО:** Все изменения должны быть протестированы перед применением на production.
