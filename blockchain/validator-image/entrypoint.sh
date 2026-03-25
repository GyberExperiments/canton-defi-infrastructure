#!/usr/bin/env bash
set -euo pipefail

# Обязательные/ожидаемые переменные окружения:
#  - CANTON_API (URL SV sponsor)
#  - ONBOARDING_SECRET (из Secret/Env)
#  - PARTY_HINT (идентификатор валидатора)
#  - VALIDATOR_MODE (0=validator, 1=observer)

# Логин в GHCR если есть токен
if [ -n "${GHCR_TOKEN:-}" ] || [ -n "${DOCKER_PASSWORD:-}" ]; then
    TOKEN="${GHCR_TOKEN:-${DOCKER_PASSWORD}}"
    USERNAME="${DOCKER_USERNAME:-TheMacroeconomicDao}"
    echo "🔐 Логин в GHCR..."
    echo "$TOKEN" | docker login ghcr.io --username "$USERNAME" --password-stdin || {
        echo "⚠️  WARNING: Не удалось залогиниться в GHCR, продолжаем..."
    }
fi

cd /opt/canton

# Экспортируем IMAGE_TAG для start.sh
export IMAGE_TAG="${CANTON_VERSION:-0.5.3}"

# VERSION файл уже создан в Dockerfile из splice-node релиза
# Проверяем что файл существует
if [ ! -f "/opt/VERSION" ]; then
  echo "ERROR: VERSION file not found at /opt/VERSION" >&2
  exit 1
fi

if [[ -z "${CANTON_API:-}" || -z "${ONBOARDING_SECRET:-}" || -z "${PARTY_HINT:-}" || -z "${VALIDATOR_MODE:-}" ]]; then
  echo "Missing required env vars: CANTON_API, ONBOARDING_SECRET, PARTY_HINT, VALIDATOR_MODE" >&2
  exit 1
fi

exec /opt/canton/start.sh \
  -s "${CANTON_API}" \
  -o "${ONBOARDING_SECRET}" \
  -p "${PARTY_HINT}" \
  -m "${VALIDATOR_MODE}" \
  -w


