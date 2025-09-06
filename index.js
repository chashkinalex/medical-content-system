#!/usr/bin/env node

/**
 * Medical Content System
 * Система автоматизации создания медицинского контента для Telegram-каналов
 * 
 * @author chashkinalex
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Импорт модулей системы
const Logger = require('./src/utils/logger');
const Database = require('./src/utils/database');
const ContentCollector = require('./src/collectors/content-collector');
const ContentProcessor = require('./src/processors/content-processor');
const ContentScorer = require('./src/scorers/content-scorer');
const PostGenerator = require('./src/generators/post-generator');
const TelegramPublisher = require('./src/publishers/telegram-publisher');
const Monitor = require('./src/utils/monitor');

class MedicalContentSystem {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        this.collector = new ContentCollector();
        this.processor = new ContentProcessor();
        this.scorer = new ContentScorer();
        this.generator = new PostGenerator();
        this.publisher = new TelegramPublisher();
        this.monitor = new Monitor();
        
        this.isRunning = false;
        this.config = this.loadConfig();
    }

    /**
     * Загрузка конфигурации
     */
    loadConfig() {
        try {
            const configPath = path.join(__dirname, 'config');
            const rssFeeds = JSON.parse(fs.readFileSync(path.join(configPath, 'rss-feeds.json'), 'utf8'));
            const postTemplates = JSON.parse(fs.readFileSync(path.join(configPath, 'post-templates.json'), 'utf8'));
            
            return {
                rssFeeds,
                postTemplates,
                scoring: {
                    threshold: parseInt(process.env.SCORING_THRESHOLD) || 14,
                    max: parseInt(process.env.SCORING_MAX) || 25
                },
                telegram: {
                    botToken: process.env.TELEGRAM_BOT_TOKEN,
                    channelId: process.env.TELEGRAM_CHANNEL_ID,
                    adminId: process.env.TELEGRAM_ADMIN_ID
                },
                database: {
                    url: process.env.DATABASE_URL || 'sqlite:./data/content.db'
                }
            };
        } catch (error) {
            this.logger.error('Ошибка загрузки конфигурации:', error);
            throw error;
        }
    }

    /**
     * Инициализация системы
     */
    async initialize() {
        try {
            this.logger.info('🚀 Инициализация Medical Content System...');
            
            // Создание необходимых директорий
            await this.createDirectories();
            
            // Инициализация базы данных
            await this.database.initialize(this.config.database.url);
            
            // Инициализация компонентов
            await this.collector.initialize(this.config.rssFeeds);
            await this.processor.initialize(this.config.postTemplates);
            await this.scorer.initialize(this.config.scoring);
            await this.generator.initialize(this.config.postTemplates);
            await this.publisher.initialize(this.config.telegram);
            await this.monitor.initialize();
            
            this.logger.info('✅ Система успешно инициализирована');
            return true;
        } catch (error) {
            this.logger.error('❌ Ошибка инициализации системы:', error);
            throw error;
        }
    }

    /**
     * Создание необходимых директорий
     */
    async createDirectories() {
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
            const dirPath = path.join(__dirname, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                this.logger.info(`📁 Создана директория: ${dir}`);
            }
        }
    }

    /**
     * Запуск системы
     */
    async start() {
        try {
            await this.initialize();
            this.isRunning = true;
            
            this.logger.info('🏥 Medical Content System запущена');
            this.logger.info('📊 Доступные команды:');
            this.logger.info('  - collect: Сбор контента из источников');
            this.logger.info('  - process: Обработка собранного контента');
            this.logger.info('  - score: Скоринг контента');
            this.logger.info('  - generate: Генерация постов');
            this.logger.info('  - publish: Публикация в Telegram');
            this.logger.info('  - monitor: Мониторинг источников');
            this.logger.info('  - analytics: Аналитика и отчеты');
            this.logger.info('  - help: Справка по командам');
            
            // Запуск мониторинга
            await this.monitor.start();
            
            // Обработка команд
            await this.handleCommands();
            
        } catch (error) {
            this.logger.error('❌ Ошибка запуска системы:', error);
            process.exit(1);
        }
    }

    /**
     * Обработка команд
     */
    async handleCommands() {
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'collect':
                await this.runCollection();
                break;
            case 'process':
                await this.runProcessing();
                break;
            case 'score':
                await this.runScoring();
                break;
            case 'generate':
                await this.runGeneration();
                break;
            case 'publish':
                await this.runPublishing();
                break;
            case 'monitor':
                await this.runMonitoring();
                break;
            case 'analytics':
                await this.runAnalytics();
                break;
            case 'help':
                this.showHelp();
                break;
            default:
                this.logger.info('💡 Используйте команду "help" для просмотра доступных команд');
                break;
        }
    }

    /**
     * Сбор контента
     */
    async runCollection() {
        this.logger.info('📥 Запуск сбора контента...');
        try {
            const results = await this.collector.collectAll();
            this.logger.info(`✅ Собрано ${results.length} новых статей`);
        } catch (error) {
            this.logger.error('❌ Ошибка сбора контента:', error);
        }
    }

    /**
     * Обработка контента
     */
    async runProcessing() {
        this.logger.info('⚙️ Запуск обработки контента...');
        try {
            const results = await this.processor.processAll();
            this.logger.info(`✅ Обработано ${results.length} статей`);
        } catch (error) {
            this.logger.error('❌ Ошибка обработки контента:', error);
        }
    }

    /**
     * Скоринг контента
     */
    async runScoring() {
        this.logger.info('📊 Запуск скоринга контента...');
        try {
            const results = await this.scorer.scoreAll();
            this.logger.info(`✅ Оценено ${results.length} статей`);
        } catch (error) {
            this.logger.error('❌ Ошибка скоринга контента:', error);
        }
    }

    /**
     * Генерация постов
     */
    async runGeneration() {
        this.logger.info('✍️ Запуск генерации постов...');
        try {
            const results = await this.generator.generateAll();
            this.logger.info(`✅ Сгенерировано ${results.length} постов`);
        } catch (error) {
            this.logger.error('❌ Ошибка генерации постов:', error);
        }
    }

    /**
     * Публикация в Telegram
     */
    async runPublishing() {
        this.logger.info('📤 Запуск публикации в Telegram...');
        try {
            const results = await this.publisher.publishAll();
            this.logger.info(`✅ Опубликовано ${results.length} постов`);
        } catch (error) {
            this.logger.error('❌ Ошибка публикации:', error);
        }
    }

    /**
     * Мониторинг источников
     */
    async runMonitoring() {
        this.logger.info('👁️ Запуск мониторинга источников...');
        try {
            const results = await this.monitor.checkAllSources();
            this.logger.info(`✅ Проверено ${results.length} источников`);
        } catch (error) {
            this.logger.error('❌ Ошибка мониторинга:', error);
        }
    }

    /**
     * Аналитика и отчеты
     */
    async runAnalytics() {
        this.logger.info('📈 Запуск аналитики...');
        try {
            const results = await this.generateAnalytics();
            this.logger.info('✅ Аналитика сгенерирована');
            console.log(results);
        } catch (error) {
            this.logger.error('❌ Ошибка аналитики:', error);
        }
    }

    /**
     * Генерация аналитики
     */
    async generateAnalytics() {
        // Здесь будет логика генерации аналитики
        return {
            totalArticles: 0,
            publishedPosts: 0,
            averageScore: 0,
            topSources: [],
            topTopics: []
        };
    }

    /**
     * Показать справку
     */
    showHelp() {
        console.log(`
🏥 Medical Content System - Справка по командам

📥 collect    - Сбор контента из RSS-фидов и PubMed
⚙️ process    - Обработка и структурирование контента
📊 score      - Скоринг контента по критериям качества
✍️ generate   - Генерация постов по шаблонам
📤 publish    - Публикация постов в Telegram
👁️ monitor    - Мониторинг источников контента
📈 analytics  - Аналитика и отчеты по системе
❓ help       - Показать эту справку

Примеры использования:
  node index.js collect
  node index.js process
  node index.js score
  node index.js generate
  node index.js publish

Для полного цикла обработки:
  npm run collect && npm run process && npm run score && npm run generate && npm run publish
        `);
    }

    /**
     * Остановка системы
     */
    async stop() {
        this.logger.info('🛑 Остановка системы...');
        this.isRunning = false;
        await this.monitor.stop();
        await this.database.close();
        this.logger.info('✅ Система остановлена');
    }
}

// Обработка сигналов завершения
process.on('SIGINT', async () => {
    console.log('\n🛑 Получен сигнал завершения...');
    if (global.medicalContentSystem) {
        await global.medicalContentSystem.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Получен сигнал завершения...');
    if (global.medicalContentSystem) {
        await global.medicalContentSystem.stop();
    }
    process.exit(0);
});

// Запуск системы
if (require.main === module) {
    const system = new MedicalContentSystem();
    global.medicalContentSystem = system;
    system.start().catch(error => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
}

module.exports = MedicalContentSystem;
