#!/usr/bin/env node

/**
 * Скрипт первоначальной настройки системы
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

async function setup() {
    const logger = new Logger();
    
    try {
        logger.start('Первоначальная настройка Medical Content System');
        
        // Проверка файла .env
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) {
            logger.warn('Файл .env не найден. Создание из env.example...');
            
            const envExamplePath = path.join(__dirname, '../env.example');
            if (fs.existsSync(envExamplePath)) {
                fs.copyFileSync(envExamplePath, envPath);
                logger.success('Файл .env создан из env.example');
                logger.info('⚠️  Не забудьте отредактировать .env файл с вашими настройками!');
            } else {
                logger.error('Файл env.example не найден!');
                process.exit(1);
            }
        }
        
        // Создание необходимых директорий
        logger.info('Создание директорий...');
        const directories = [
            'data',
            'logs',
            'cache',
            'output',
            'backups',
            'templates',
            'visuals'
        ];
        
        for (const dir of directories) {
            const dirPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                logger.info(`📁 Создана директория: ${dir}`);
            }
        }
        
        // Инициализация базы данных
        logger.info('Инициализация базы данных...');
        const database = new Database();
        await database.initialize(process.env.DATABASE_URL || 'sqlite:./data/content.db');
        
        // Инициализация источников
        logger.info('Инициализация источников...');
        const initSources = require('./init-sources');
        await initSources();
        
        // Проверка конфигурации
        logger.info('Проверка конфигурации...');
        await checkConfiguration();
        
        // Тестирование системы
        logger.info('Тестирование системы...');
        await testSystem();
        
        logger.complete('Первоначальная настройка завершена успешно!');
        logger.info('🎉 Система готова к работе!');
        logger.info('📚 Следующие шаги:');
        logger.info('  1. Отредактируйте .env файл с вашими настройками');
        logger.info('  2. Настройте Telegram бота и канал');
        logger.info('  3. Запустите тест сбора: npm run collect:test');
        logger.info('  4. Запустите полный сбор: npm run collect');
        
    } catch (error) {
        logger.error('Ошибка настройки системы:', error);
        process.exit(1);
    }
}

/**
 * Проверка конфигурации
 */
async function checkConfiguration() {
    const logger = new Logger();
    
    try {
        // Проверка файлов конфигурации
        const configFiles = [
            'config/rss-feeds.json',
            'config/specializations.json',
            'config/post-templates.json'
        ];
        
        for (const configFile of configFiles) {
            const configPath = path.join(__dirname, '..', configFile);
            if (fs.existsSync(configPath)) {
                logger.info(`✅ Конфигурация найдена: ${configFile}`);
                
                // Проверка валидности JSON
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    logger.info(`   - Записей: ${Object.keys(config).length}`);
                } catch (error) {
                    logger.error(`❌ Ошибка в конфигурации ${configFile}:`, error);
                }
            } else {
                logger.error(`❌ Конфигурация не найдена: ${configFile}`);
            }
        }
        
        // Проверка переменных окружения
        const requiredEnvVars = [
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHANNEL_ID'
        ];
        
        logger.info('Проверка переменных окружения...');
        for (const envVar of requiredEnvVars) {
            if (process.env[envVar] && process.env[envVar] !== `your_${envVar.toLowerCase()}_here`) {
                logger.info(`✅ ${envVar}: настроен`);
            } else {
                logger.warn(`⚠️  ${envVar}: не настроен`);
            }
        }
        
    } catch (error) {
        logger.error('Ошибка проверки конфигурации:', error);
    }
}

/**
 * Тестирование системы
 */
async function testSystem() {
    const logger = new Logger();
    
    try {
        // Тест базы данных
        logger.info('Тестирование базы данных...');
        const database = new Database();
        await database.initialize(process.env.DATABASE_URL || 'sqlite:./data/content.db');
        
        const sources = await database.all('SELECT COUNT(*) as count FROM sources');
        logger.info(`✅ База данных: ${sources[0].count} источников`);
        
        // Тест конфигурации RSS
        logger.info('Тестирование конфигурации RSS...');
        const feedsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/rss-feeds.json'), 'utf8'
        ));
        logger.info(`✅ RSS-фиды: ${feedsConfig.feeds.length} источников`);
        
        // Тест конфигурации специальностей
        logger.info('Тестирование конфигурации специальностей...');
        const specializationsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/specializations.json'), 'utf8'
        ));
        logger.info(`✅ Специальности: ${Object.keys(specializationsConfig.specializations).length} кафедр`);
        
        // Тест конфигурации шаблонов
        logger.info('Тестирование конфигурации шаблонов...');
        const templatesConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/post-templates.json'), 'utf8'
        ));
        logger.info(`✅ Шаблоны: ${Object.keys(templatesConfig.templates).length} типов постов`);
        
    } catch (error) {
        logger.error('Ошибка тестирования системы:', error);
    }
}

// Запуск настройки
if (require.main === module) {
    setup();
}

module.exports = setup;
