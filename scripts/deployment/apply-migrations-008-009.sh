#!/bin/bash
# Скрипт для применения миграций 008 и 009
# Миграция 008: Добавление поля is_market_price
# Миграция 009: Добавление поля market_price_discount_percent

set -e

NAMESPACE="supabase"
POD_NAME="postgres-0"
DB_NAME="supabase"
DB_USER="supabase"

echo "🚀 Применение миграций 008 и 009 для Canton OTC Platform"
echo "=========================================================="

# Проверка что pod существует
if ! kubectl get pod -n "$NAMESPACE" "$POD_NAME" &>/dev/null; then
    echo "❌ Pod $POD_NAME не найден в namespace $NAMESPACE"
    echo "Проверьте что Supabase развернут:"
    echo "  kubectl get pods -n $NAMESPACE"
    exit 1
fi

# Проверка что pod готов
POD_STATUS=$(kubectl get pod -n "$NAMESPACE" "$POD_NAME" -o jsonpath='{.status.phase}')
if [ "$POD_STATUS" != "Running" ]; then
    echo "❌ Pod $POD_NAME не в статусе Running (текущий статус: $POD_STATUS)"
    exit 1
fi

echo "✅ Pod $POD_NAME готов"

# Получение пароля из секрета
echo "🔐 Получение пароля из секрета..."
POSTGRES_PASSWORD=$(kubectl get secret postgres-secret -n "$NAMESPACE" -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Не удалось получить пароль из секрета postgres-secret"
    echo "Проверьте что секрет существует:"
    echo "  kubectl get secret postgres-secret -n $NAMESPACE"
    exit 1
fi

echo "✅ Пароль получен"

# Функция для применения миграции
apply_migration() {
    local migration_file=$1
    local migration_name=$2
    
    echo ""
    echo "📦 Применение миграции: $migration_name"
    echo "   Файл: $migration_file"
    
    # Копирование файла в pod
    echo "   Копирование файла в pod..."
    kubectl cp "$migration_file" "$NAMESPACE/$POD_NAME:/tmp/$(basename $migration_file)" || {
        echo "❌ Ошибка копирования файла"
        return 1
    }
    
    # Применение миграции
    echo "   Применение миграции..."
    kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c \
        "PGPASSWORD='$POSTGRES_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -f /tmp/$(basename $migration_file)" || {
        echo "❌ Ошибка применения миграции"
        return 1
    }
    
    echo "✅ Миграция $migration_name применена успешно"
}

# Проверка существования файлов миграций
MIGRATIONS_DIR="supabase/migrations"
MIGRATION_008="$MIGRATIONS_DIR/008_add_is_market_price.sql"
MIGRATION_009="$MIGRATIONS_DIR/009_add_market_price_discount.sql"

if [ ! -f "$MIGRATION_008" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_008"
    exit 1
fi

if [ ! -f "$MIGRATION_009" ]; then
    echo "❌ Файл миграции не найден: $MIGRATION_009"
    exit 1
fi

# Применение миграций
apply_migration "$MIGRATION_008" "008_add_is_market_price"
apply_migration "$MIGRATION_009" "009_add_market_price_discount"

echo ""
echo "✅ Все миграции применены успешно!"
echo ""
echo "🔍 Проверка структуры таблицы..."

# Проверка что колонки созданы
kubectl exec -n "$NAMESPACE" "$POD_NAME" -- bash -c \
    "PGPASSWORD='$POSTGRES_PASSWORD' psql -h localhost -U $DB_USER -d $DB_NAME -c \"
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'public_orders' 
  AND column_name IN ('is_market_price', 'market_price_discount_percent')
ORDER BY column_name;
\"" || {
    echo "⚠️  Не удалось проверить структуру таблицы"
}

echo ""
echo "🎉 Готово! Миграции применены."
echo ""
echo "📝 Следующие шаги:"
echo "   1. Проверить логи приложения:"
echo "      kubectl logs -n canton-otc deployment/canton-otc --tail=50"
echo ""
echo "   2. Протестировать создание заявки с market price и discount"
echo ""
echo "   3. Проверить что заявки сохраняются без ошибок DATABASE_ERROR"
