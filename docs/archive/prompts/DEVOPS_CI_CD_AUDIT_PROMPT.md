# Промпт для аудита DevOps и CI/CD (best practices 2025)

Скопируй и выполни этот промпт, чтобы провести полный аудит и привести CI/CD в соответствие с best practices 2025:

---

## Контекст

Проект: Next.js 15 OTC-платформа с Kubernetes-деплоем.

Текущая структура CI/CD:
- `deploy-ci.yml` — lint, type-check, build на push/PR в main
- `deploy.yml` — деплой в production при push в main (Docker → GHCR → kubectl)
- `test.yml` — unit и integration тесты на main/develop
- `simple-deploy.yml` — fallback deploy через workflow_dispatch
- `deploy-minimal-stage.yml` — деплой в minimal-stage окружение

---

## Задачи аудита

1. **Анализ текущего CI/CD:**
   - Прочитать все workflow-файлы в `.github/workflows/`
   - Проверить триггеры, concurrency, зависимости между jobs
   - Оценить использование секретов и безопасности

2. **Best practices 2025:**
   - GitHub Actions: use latest stable action versions (actions/checkout@v4, setup-node@v4, etc.)
   - Reusable workflows для дублирования (DRY)
   - Dependabot/Renovate для обновления actions
   - Proper caching (pnpm, build artifacts)
   - Security: OIDC для облачных провайдеров вместо долгоживущих credentials где возможно
   - Concurrency для предотвращения параллельных деплоев
   - Matrix builds только где оправдано
   - Fail-fast vs continue-on-error — сознательный выбор

3. **Конкретные улучшения (без поломки):**
   - Объединить дублирующийся setup (pnpm, node) в composite action или reusable workflow
   - Унифицировать пути к k8s-манифестам (config/kubernetes/k8s vs k8s)
   - Проверить что deploy-ci и deploy не конфликтуют при push в main
   - Добавить job summary для быстрого обзора результата
   - Рассмотреть использование environments для approval gates в production

4. **Ограничения:**
   - Не менять логику деплоя (kubectl, секреты, образы)
   - Не ломать существующие pipeline
   - Все изменения должны быть backward-compatible

---

## Выход

1. Отчёт с найденными проблемами и рекомендациями
2. Конкретные патчи/правки для workflow-файлов
3. Краткий чеклист "что сделано" после применения

---

## Референсы 2025

- GitHub Actions best practices: https://docs.github.com/en/actions
- Reusable workflows: https://docs.github.com/en/actions/using-workflows/reusing-workflows
- OIDC with cloud providers: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments
