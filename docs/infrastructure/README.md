# 🏗️ Infrastructure Documentation

K8s/K3s, восстановление кластера, Cert-Manager. Документы и промпты, на которые ссылаются скрипты восстановления.

## 📋 Ключевые документы

### Восстановление кластера
- **[COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT.md](./COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT.md)** - Полное восстановление и обеззараживание кластера (7 этапов). Используется скриптом `scripts/complete-cluster-recovery.sh`
- **[CLUSTER_RECOVERY_PLAN.md](./CLUSTER_RECOVERY_PLAN.md)** - План восстановления кластера
- **[CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md](./CLUSTER_RECOVERY_AND_ORGANIZATION_PLAN.md)** - План восстановления и организации
- **[CLUSTER_RECOVERY_STATUS_REPORT.md](./CLUSTER_RECOVERY_STATUS_REPORT.md)** - Текущий статус восстановления
- **[CLUSTER_RECOVERY_EXPERT_PROMPT.md](./CLUSTER_RECOVERY_EXPERT_PROMPT.md)** - Экспертный промпт по восстановлению
- **[EMERGENCY_CLUSTER_RECOVERY_FINAL.md](./EMERGENCY_CLUSTER_RECOVERY_FINAL.md)** - Экстренное восстановление (финальный план)
- **[CONTINUE_CLUSTER_RECOVERY_PROMPT.md](./CONTINUE_CLUSTER_RECOVERY_PROMPT.md)** - Продолжение восстановления
- **[RECOVERY_IMPROVEMENTS.md](./RECOVERY_IMPROVEMENTS.md)** - Улучшения процесса восстановления
- **[RADICAL_SOLUTION.md](./RADICAL_SOLUTION.md)** - Радикальное решение по очистке

### Cert-Manager
- **[CERT_MANAGER_ROOT_CAUSE_ANALYSIS.md](./CERT_MANAGER_ROOT_CAUSE_ANALYSIS.md)** - Анализ корневой причины (Pending поды, solver)
- **[FINAL_CERT_MANAGER_FIX_PROMPT.md](./FINAL_CERT_MANAGER_FIX_PROMPT.md)** - Детальный промпт по исправлению. Используется скриптом `scripts/fix-cert-manager-complete.sh`
- **[CERT_MANAGER_PENDING_PODS_FIX_PROMPT.md](./CERT_MANAGER_PENDING_PODS_FIX_PROMPT.md)** - Исправление проблемы с Pending подами

### Kubernetes / K3s
- **[KUBERNETES_CLUSTER_FIX_PROMPT.md](./KUBERNETES_CLUSTER_FIX_PROMPT.md)** - Исходное описание проблем кластера
- **[KUBERNETES_FIX_EXECUTION_GUIDE.md](./KUBERNETES_FIX_EXECUTION_GUIDE.md)** - Руководство по выполнению исправлений K8s
- **[KUBERNETES_FIX_REPORT.md](./KUBERNETES_FIX_REPORT.md)** - Отчёт по исправлениям K8s
- **[KUBERNETES_CLUSTER_DEEP_ANALYSIS_PROMPT.md](./KUBERNETES_CLUSTER_DEEP_ANALYSIS_PROMPT.md)** - Глубокий анализ кластера
- **[KUBERNETES_CLUSTER_CRITICAL_FIX_PROMPT.md](./KUBERNETES_CLUSTER_CRITICAL_FIX_PROMPT.md)** - Критические исправления кластера
- **[CLUSTER_ANALYSIS_REPORT.md](./CLUSTER_ANALYSIS_REPORT.md)** - Отчёт по анализу кластера
- **[K3S_CRITICAL_RECOVERY_PROMPT.md](./K3S_CRITICAL_RECOVERY_PROMPT.md)** - Критическое восстановление K3s
- **[K3S_FULL_RECOVERY_EXPERT_PROMPT.md](./K3S_FULL_RECOVERY_EXPERT_PROMPT.md)** - Полное восстановление K3s (эксперт)
- **[K3S_RECOVERY_FINAL_PROMPT.md](./K3S_RECOVERY_FINAL_PROMPT.md)** - Финальный промпт по восстановлению K3s

## 🎯 Связанные скрипты

- `../scripts/complete-cluster-recovery.sh` — автоматизация 7 этапов из COMPLETE_CLUSTER_RECOVERY_AND_SECURITY_PROMPT
- `../scripts/fix-cert-manager-complete.sh` — исправление cert-manager по FINAL_CERT_MANAGER_FIX_PROMPT
- `../scripts/QUICK_RECOVERY_GUIDE.md` — быстрый гайд по восстановлению
- `../scripts/KUBERNETES_FIX_README.md` — описание K8s-скриптов и диагностики
- `../scripts/CERT_MANAGER_FIX_README.md` — описание скрипта cert-manager
