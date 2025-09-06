#!/usr/bin/env node

/**
 * Скрипт для настройки telegram-to-rss
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const Logger = require('../src/utils/logger');

async function setupTelegramToRss() {
    const logger = new Logger();
    
    try {
        logger.start('Настройка telegram-to-rss системы');
        
        // Проверка Docker
        logger.info('Проверка Docker...');
        try {
            execSync('docker --version', { stdio: 'pipe' });
            logger.success('Docker установлен');
        } catch (error) {
            logger.error('Docker не установлен. Установите Docker и попробуйте снова.');
            process.exit(1);
        }

        // Проверка Docker Compose
        logger.info('Проверка Docker Compose...');
        try {
            execSync('docker-compose --version', { stdio: 'pipe' });
            logger.success('Docker Compose установлен');
        } catch (error) {
            logger.error('Docker Compose не установлен. Установите Docker Compose и попробуйте снова.');
            process.exit(1);
        }

        // Создание необходимых директорий
        logger.info('Создание директорий...');
        const directories = [
            'data/telegram-sessions',
            'data/rsshub',
            'data/redis',
            'logs/telegram-to-rss'
        ];

        for (const dir of directories) {
            const dirPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                logger.info(`📁 Создана директория: ${dir}`);
            }
        }

        // Проверка переменных окружения
        logger.info('Проверка переменных окружения...');
        const requiredEnvVars = [
            'TELEGRAM_API_ID',
            'TELEGRAM_API_HASH',
            'TELEGRAM_PHONE'
        ];

        const missingVars = [];
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                missingVars.push(envVar);
            }
        }

        if (missingVars.length > 0) {
            logger.warn('Отсутствуют переменные окружения:');
            missingVars.forEach(varName => {
                logger.warn(`  - ${varName}`);
            });
            logger.info('Добавьте эти переменные в .env файл');
        }

        // Создание .env файла для telegram-to-rss
        const envPath = path.join(__dirname, '..', '.env.telegram');
        if (!fs.existsSync(envPath)) {
            const envContent = `# Telegram API Configuration
TELEGRAM_API_ID=your_telegram_api_id_here
TELEGRAM_API_HASH=your_telegram_api_hash_here
TELEGRAM_PHONE=your_phone_number_here
TELEGRAM_SESSION_STRING=your_session_string_here

# Telegram-to-RSS Configuration
UPDATE_INTERVAL=300000
MAX_POSTS_PER_CHANNEL=50
LOG_LEVEL=info

# RSSHub Configuration
NODE_ENV=production
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379/
PUPPETEER_WS_ENDPOINT=ws://browserless:3000
`;
            fs.writeFileSync(envPath, envContent);
            logger.info('📄 Создан файл .env.telegram');
        }

        // Загрузка конфигурации каналов
        logger.info('Загрузка конфигурации каналов...');
        const channelsConfigPath = path.join(__dirname, '..', 'config/telegram-channels.json');
        if (fs.existsSync(channelsConfigPath)) {
            const channelsConfig = JSON.parse(fs.readFileSync(channelsConfigPath, 'utf8'));
            logger.success(`Загружено ${Object.keys(channelsConfig).length} специальностей`);
            
            // Подсчет общего количества каналов
            const totalChannels = Object.values(channelsConfig).reduce((sum, channels) => sum + channels.length, 0);
            logger.info(`Всего каналов для мониторинга: ${totalChannels}`);
        } else {
            logger.error('Файл конфигурации каналов не найден. Запустите сначала extract-telegram-channels.js');
            process.exit(1);
        }

        // Создание скрипта запуска
        const startScriptPath = path.join(__dirname, '..', 'scripts/start-telegram-to-rss.sh');
        const startScriptContent = `#!/bin/bash

# Скрипт запуска telegram-to-rss системы

echo "🚀 Запуск telegram-to-rss системы..."

# Загрузка переменных окружения
if [ -f .env.telegram ]; then
    export \$(cat .env.telegram | grep -v '^#' | xargs)
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
`;
        fs.writeFileSync(startScriptPath, startScriptContent);
        fs.chmodSync(startScriptPath, '755');
        logger.info('📄 Создан скрипт запуска: scripts/start-telegram-to-rss.sh');

        // Создание скрипта остановки
        const stopScriptPath = path.join(__dirname, '..', 'scripts/stop-telegram-to-rss.sh');
        const stopScriptContent = `#!/bin/bash

echo "🛑 Остановка telegram-to-rss системы..."

# Остановка Docker контейнеров
docker-compose -f docker-compose.telegram.yml down

echo "✅ telegram-to-rss система остановлена!"
`;
        fs.writeFileSync(stopScriptPath, stopScriptContent);
        fs.chmodSync(stopScriptPath, '755');
        logger.info('📄 Создан скрипт остановки: scripts/stop-telegram-to-rss.sh');

        logger.complete('Настройка telegram-to-rss завершена!');
        logger.info('📋 Следующие шаги:');
        logger.info('  1. Настройте переменные окружения в .env.telegram');
        logger.info('  2. Получите Telegram API credentials на https://my.telegram.org');
        logger.info('  3. Запустите систему: ./scripts/start-telegram-to-rss.sh');
        logger.info('  4. Проверьте RSS-фиды в браузере');

    } catch (error) {
        logger.error('Ошибка настройки telegram-to-rss:', error);
        process.exit(1);
    }
}

// Запуск настройки
if (require.main === module) {
    setupTelegramToRss();
}

module.exports = setupTelegramToRss;
