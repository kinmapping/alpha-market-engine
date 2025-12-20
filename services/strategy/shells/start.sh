#!/bin/bash
set -e

# データベースURLが設定されている場合のみマイグレーションを実行
if [ -n "$DATABASE_URL" ]; then
    echo "Running database migrations..."
    cd /app
    if ! alembic upgrade head; then
        echo "ERROR: Migration failed. Please check the database connection and logs."
        echo "Database URL: ${DATABASE_URL}"
        exit 1
    fi
    echo "Migrations completed successfully."
else
    echo "Warning: DATABASE_URL not set. Skipping migrations."
fi

echo "Starting strategy module..."
cd /app/strategy
exec python main.py
