#!/bin/bash

# 🔐 Canton OTC Security Audit Script
# Автоматизированный скрипт для проведения базового аудита безопасности

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Переменные
NAMESPACE="${1:-canton-otc-minimal-stage}"
REPORT_FILE="security-audit-report-$(date +%Y%m%d-%H%M%S).md"

echo -e "${BLUE}🔐 Starting Security Audit for namespace: $NAMESPACE${NC}"
echo ""

# Функция для записи в отчет
write_report() {
    echo "$1" >> "$REPORT_FILE"
}

# Инициализация отчета
write_report "# Security Audit Report"
write_report "**Date**: $(date)"
write_report "**Namespace**: $NAMESPACE"
write_report ""

# 1. Проверка RBAC
echo -e "${YELLOW}📋 Checking RBAC Configuration...${NC}"
write_report "## 1. RBAC Configuration"
write_report "\`\`\`"
kubectl get roles,rolebindings -n "$NAMESPACE" >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 2. Проверка Pod Security
echo -e "${YELLOW}🛡️ Checking Pod Security...${NC}"
write_report "## 2. Pod Security Analysis"
write_report "\`\`\`json"

kubectl get pods -n "$NAMESPACE" -o json | jq '.items[] | {
  name: .metadata.name,
  securityContext: .spec.securityContext,
  containers: [.spec.containers[] | {
    name: .name,
    image: .image,
    securityContext: .securityContext
  }]
}' >> "$REPORT_FILE" 2>&1

write_report "\`\`\`"
write_report ""

# 3. Проверка Network Policies
echo -e "${YELLOW}🌐 Checking Network Policies...${NC}"
write_report "## 3. Network Policies"

NP_COUNT=$(kubectl get networkpolicies -n "$NAMESPACE" 2>/dev/null | grep -v NAME | wc -l)
if [ "$NP_COUNT" -eq 0 ]; then
    write_report "⚠️ **WARNING**: No network policies found in namespace $NAMESPACE"
    echo -e "${RED}⚠️  No network policies found!${NC}"
else
    write_report "✅ Found $NP_COUNT network policies"
    write_report "\`\`\`"
    kubectl get networkpolicies -n "$NAMESPACE" >> "$REPORT_FILE" 2>&1
    write_report "\`\`\`"
fi
write_report ""

# 4. Проверка Secrets
echo -e "${YELLOW}🔑 Checking Secrets...${NC}"
write_report "## 4. Secrets Analysis"
write_report "\`\`\`"
kubectl get secrets -n "$NAMESPACE" | grep -v "kubernetes.io/service-account-token" >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 5. Проверка Service Accounts
echo -e "${YELLOW}👤 Checking Service Accounts...${NC}"
write_report "## 5. Service Accounts"
write_report "\`\`\`"
kubectl get serviceaccounts -n "$NAMESPACE" -o json | jq '.items[] | {
  name: .metadata.name,
  automountServiceAccountToken: .automountServiceAccountToken
}' >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 6. Проверка Resource Limits
echo -e "${YELLOW}📊 Checking Resource Limits...${NC}"
write_report "## 6. Resource Limits"
write_report "\`\`\`yaml"
kubectl get pods -n "$NAMESPACE" -o json | jq '.items[] | {
  name: .metadata.name,
  containers: [.spec.containers[] | {
    name: .name,
    resources: .resources
  }]
}' >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 7. Проверка Image Pull Policies
echo -e "${YELLOW}🐳 Checking Image Pull Policies...${NC}"
write_report "## 7. Image Pull Policies"
write_report "\`\`\`"
kubectl get pods -n "$NAMESPACE" -o json | jq '.items[] | {
  name: .metadata.name,
  containers: [.spec.containers[] | {
    name: .name,
    image: .image,
    imagePullPolicy: .imagePullPolicy
  }]
}' >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 8. Проверка Ingress/Routes
echo -e "${YELLOW}🚪 Checking Ingress Configuration...${NC}"
write_report "## 8. Ingress/Routes"
write_report "\`\`\`"
kubectl get ingressroute,ingress -n "$NAMESPACE" >> "$REPORT_FILE" 2>&1
write_report "\`\`\`"
write_report ""

# 9. Проверка Events на ошибки безопасности
echo -e "${YELLOW}📅 Checking Security Events...${NC}"
write_report "## 9. Recent Security Events"
write_report "\`\`\`"
kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' | grep -E "(Failed|Error|Killing|Unhealthy|FailedMount|FailedScheduling)" | tail -20 >> "$REPORT_FILE" 2>&1 || echo "No security-related events found" >> "$REPORT_FILE"
write_report "\`\`\`"
write_report ""

# 10. Summary и рекомендации
echo -e "${YELLOW}📝 Generating Summary...${NC}"
write_report "## 10. Summary and Recommendations"
write_report ""

# Подсчет проблем
ISSUES=0

# Проверка Pod Security Context
POD_NO_SC=$(kubectl get pods -n "$NAMESPACE" -o json | jq '[.items[] | select(.spec.securityContext == null)] | length')
if [ "$POD_NO_SC" -gt 0 ]; then
    write_report "- ⚠️ **$POD_NO_SC pods without security context**"
    ((ISSUES++))
fi

# Проверка Container Security Context
CONT_NO_SC=$(kubectl get pods -n "$NAMESPACE" -o json | jq '[.items[].spec.containers[] | select(.securityContext == null)] | length')
if [ "$CONT_NO_SC" -gt 0 ]; then
    write_report "- ⚠️ **$CONT_NO_SC containers without security context**"
    ((ISSUES++))
fi

# Проверка Network Policies
if [ "$NP_COUNT" -eq 0 ]; then
    write_report "- ⚠️ **No network policies configured**"
    ((ISSUES++))
fi

# Проверка Service Account Token Auto-mount
SA_AUTOMOUNT=$(kubectl get serviceaccounts -n "$NAMESPACE" -o json | jq '[.items[] | select(.automountServiceAccountToken != false)] | length')
if [ "$SA_AUTOMOUNT" -gt 0 ]; then
    write_report "- ⚠️ **$SA_AUTOMOUNT service accounts with automount enabled**"
    ((ISSUES++))
fi

write_report ""
write_report "### Total Issues Found: $ISSUES"
write_report ""

if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ Security audit completed. No critical issues found!${NC}"
    write_report "✅ **Status**: PASSED - No critical security issues detected"
else
    echo -e "${RED}❌ Security audit completed. Found $ISSUES issues!${NC}"
    write_report "❌ **Status**: FAILED - Found $ISSUES security issues that need attention"
fi

write_report ""
write_report "### Recommendations:"
write_report "1. Add security contexts to all pods and containers"
write_report "2. Implement network policies for traffic control"
write_report "3. Disable automountServiceAccountToken where not needed"
write_report "4. Set resource limits for all containers"
write_report "5. Use specific image tags instead of 'latest'"
write_report ""
write_report "---"
write_report "Report generated by Canton OTC Security Audit Script v1.0"

echo ""
echo -e "${GREEN}✅ Audit complete! Report saved to: $REPORT_FILE${NC}"
