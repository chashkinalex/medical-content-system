#!/bin/bash

# Скрипт запуска telegram-to-rss системы

echo "🚀 Запуск telegram-to-rss системы..."

# Загрузка переменных окружения
if [ -f .env.telegram ]; then
    export $(cat .env.telegram | grep -v '^#' | xargs)
    echo "✅ Переменные окружения загружены"
else
    echo "❌ Файл .env.telegram не найден"
    exit 1
fi

# Запуск Docker Compose
echo "🐳 Запуск Docker контейнеров..."
docker-compose -f docker-compose.telegram.yml up -d

# Ожидание запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверка статуса
echo "📊 Проверка статуса сервисов..."
docker-compose -f docker-compose.telegram.yml ps

echo "✅ telegram-to-rss система запущена!"
echo "📡 RSS-фиды доступны по адресам:"
echo "  - Кардиология: http://localhost:8080/cardiology"
echo "  - Педиатрия: http://localhost:8080/pediatrics"
echo "  - Гастроэнтерология: http://localhost:8080/gastroenterology"
echo "  - Эндокринология: http://localhost:8080/endocrinology"
echo "  - Гинекология: http://localhost:8080/gynecology"
echo "  - Неврология: http://localhost:8080/neurology"
echo "  - Терапия: http://localhost:8080/therapy"
