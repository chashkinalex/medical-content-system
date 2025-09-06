#!/bin/bash

echo "🛑 Остановка telegram-to-rss системы..."

# Остановка Docker контейнеров
docker-compose -f docker-compose.telegram.yml down

echo "✅ telegram-to-rss система остановлена!"
