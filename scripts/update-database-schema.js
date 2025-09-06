#!/usr/bin/env node

/**
 * Скрипт обновления схемы базы данных
 * Добавляет новые поля для поддержки всех функций системы
 */

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');
const path = require('path');

class DatabaseSchemaUpdater {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
    }

    /**
     * Обновление схемы базы данных
     */
    async updateSchema() {
        try {
            this.logger.info('🔄 Начинаем обновление схемы базы данных...');

            // Инициализация базы данных
            await this.database.initialize();

            // Обновление существующих таблиц
            await this.updateExistingTables();

            // Создание новых таблиц
            await this.createNewTables();

            // Создание новых индексов
            await this.createNewIndexes();

            // Обновление настроек
            await this.updateSettings();

            this.logger.info('✅ Схема базы данных успешно обновлена!');

        } catch (error) {
            this.logger.error('❌ Ошибка при обновлении схемы базы данных:', error);
            throw error;
        }
    }

    /**
     * Обновление существующих таблиц
     */
    async updateExistingTables() {
        this.logger.info('📝 Обновление существующих таблиц...');

        const updates = [
            // Обновление таблицы sources
            {
                table: 'sources',
                columns: [
                    'ADD COLUMN IF NOT EXISTS tags TEXT',
                    'ADD COLUMN IF NOT EXISTS update_interval INTEGER DEFAULT 3600000',
                    'ADD COLUMN IF NOT EXISTS last_error TEXT',
                    'ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0'
                ]
            },

            // Обновление таблицы articles
            {
                table: 'articles',
                columns: [
                    'ADD COLUMN IF NOT EXISTS content_hash TEXT',
                    'ADD COLUMN IF NOT EXISTS word_count INTEGER',
                    'ADD COLUMN IF NOT EXISTS reading_time INTEGER',
                    'ADD COLUMN IF NOT EXISTS language TEXT DEFAULT "unknown"',
                    'ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT "general"',
                    'ADD COLUMN IF NOT EXISTS content_category TEXT',
                    'ADD COLUMN IF NOT EXISTS keywords TEXT',
                    'ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS processed_date DATETIME',
                    'ADD COLUMN IF NOT EXISTS scored_date DATETIME',
                    'ADD COLUMN IF NOT EXISTS source_name TEXT',
                    'ADD COLUMN IF NOT EXISTS source_url TEXT'
                ]
            },

            // Обновление таблицы posts
            {
                table: 'posts',
                columns: [
                    'ADD COLUMN IF NOT EXISTS specialization TEXT',
                    'ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT "research"',
                    'ADD COLUMN IF NOT EXISTS summary TEXT',
                    'ADD COLUMN IF NOT EXISTS key_points TEXT',
                    'ADD COLUMN IF NOT EXISTS practical_application TEXT',
                    'ADD COLUMN IF NOT EXISTS hashtags TEXT',
                    'ADD COLUMN IF NOT EXISTS word_count INTEGER',
                    'ADD COLUMN IF NOT EXISTS reading_time INTEGER',
                    'ADD COLUMN IF NOT EXISTS generated_date DATETIME',
                    'ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT "pending"',
                    'ADD COLUMN IF NOT EXISTS moderator_id TEXT',
                    'ADD COLUMN IF NOT EXISTS moderator_decision TEXT',
                    'ADD COLUMN IF NOT EXISTS moderator_notes TEXT',
                    'ADD COLUMN IF NOT EXISTS decision_date DATETIME',
                    'ADD COLUMN IF NOT EXISTS revision_comment TEXT',
                    'ADD COLUMN IF NOT EXISTS revision_status TEXT DEFAULT "none"',
                    'ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS forwards INTEGER DEFAULT 0'
                ]
            },

            // Обновление таблицы scoring
            {
                table: 'scoring',
                columns: [
                    'ADD COLUMN IF NOT EXISTS scientific_basis INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS relevance INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS practicality INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS quality_level TEXT DEFAULT "D"',
                    'ADD COLUMN IF NOT EXISTS breakdown TEXT',
                    'ADD COLUMN IF NOT EXISTS source_quality INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS evidence_level INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS freshness INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS clinical_applicability INTEGER DEFAULT 0',
                    'ADD COLUMN IF NOT EXISTS methodology_quality INTEGER DEFAULT 0'
                ]
            }
        ];

        for (const update of updates) {
            for (const column of update.columns) {
                try {
                    await this.database.run(`ALTER TABLE ${update.table} ${column}`);
                    this.logger.info(`  ✅ ${update.table}: ${column}`);
                } catch (error) {
                    // Игнорируем ошибки если колонка уже существует
                    if (!error.message.includes('duplicate column name')) {
                        this.logger.warn(`  ⚠️ ${update.table}: ${column} - ${error.message}`);
                    }
                }
            }
        }
    }

    /**
     * Создание новых таблиц
     */
    async createNewTables() {
        this.logger.info('🆕 Создание новых таблиц...');

        const newTables = [
            // Таблица для очереди премодерации
            `CREATE TABLE IF NOT EXISTS moderation_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                specialization TEXT NOT NULL,
                score INTEGER NOT NULL,
                source_url TEXT,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                moderator_decision TEXT,
                moderator_notes TEXT,
                decision_date DATETIME,
                FOREIGN KEY (post_id) REFERENCES posts (id)
            )`,

            // Таблица для очереди доработки
            `CREATE TABLE IF NOT EXISTS revision_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                original_content TEXT NOT NULL,
                revision_notes TEXT,
                revision_comment TEXT,
                status TEXT DEFAULT 'pending',
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_date DATETIME,
                FOREIGN KEY (post_id) REFERENCES posts (id)
            )`,

            // Таблица для метрик по специальностям
            `CREATE TABLE IF NOT EXISTS specialization_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                specialization TEXT NOT NULL,
                date DATE NOT NULL,
                articles_count INTEGER DEFAULT 0,
                posts_count INTEGER DEFAULT 0,
                published_count INTEGER DEFAULT 0,
                average_score REAL DEFAULT 0,
                moderation_count INTEGER DEFAULT 0,
                revision_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(specialization, date)
            )`,

            // Таблица для логов системы
            `CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                component TEXT,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Таблица для конфигурации Telegram ботов
            `CREATE TABLE IF NOT EXISTS telegram_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_type TEXT NOT NULL,
                bot_token TEXT NOT NULL,
                channel_id TEXT,
                enabled BOOLEAN DEFAULT 1,
                last_activity DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Таблица для статистики публикаций
            `CREATE TABLE IF NOT EXISTS publication_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                channel_id TEXT NOT NULL,
                message_id INTEGER,
                published_date DATETIME NOT NULL,
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                comments INTEGER DEFAULT 0,
                forwards INTEGER DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES posts (id)
            )`
        ];

        for (const table of newTables) {
            try {
                await this.database.run(table);
                const tableName = table.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
                this.logger.info(`  ✅ Создана таблица: ${tableName}`);
            } catch (error) {
                this.logger.error(`  ❌ Ошибка создания таблицы: ${error.message}`);
            }
        }
    }

    /**
     * Создание новых индексов
     */
    async createNewIndexes() {
        this.logger.info('🔍 Создание новых индексов...');

        const newIndexes = [
            // Индексы для статей
            'CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash)',
            'CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language)',
            'CREATE INDEX IF NOT EXISTS idx_articles_content_type ON articles(content_type)',
            'CREATE INDEX IF NOT EXISTS idx_articles_processed_date ON articles(processed_date)',
            'CREATE INDEX IF NOT EXISTS idx_articles_scored_date ON articles(scored_date)',

            // Индексы для постов
            'CREATE INDEX IF NOT EXISTS idx_posts_specialization ON posts(specialization)',
            'CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type)',
            'CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON posts(moderation_status)',
            'CREATE INDEX IF NOT EXISTS idx_posts_generated_date ON posts(generated_date)',

            // Индексы для скоринга
            'CREATE INDEX IF NOT EXISTS idx_scoring_quality_level ON scoring(quality_level)',
            'CREATE INDEX IF NOT EXISTS idx_scoring_total_score ON scoring(total_score)',

            // Индексы для очереди премодерации
            'CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status)',
            'CREATE INDEX IF NOT EXISTS idx_moderation_queue_specialization ON moderation_queue(specialization)',
            'CREATE INDEX IF NOT EXISTS idx_moderation_queue_created_date ON moderation_queue(created_date)',

            // Индексы для очереди доработки
            'CREATE INDEX IF NOT EXISTS idx_revision_queue_status ON revision_queue(status)',
            'CREATE INDEX IF NOT EXISTS idx_revision_queue_created_date ON revision_queue(created_date)',

            // Индексы для метрик
            'CREATE INDEX IF NOT EXISTS idx_specialization_metrics_specialization ON specialization_metrics(specialization)',
            'CREATE INDEX IF NOT EXISTS idx_specialization_metrics_date ON specialization_metrics(date)',

            // Индексы для логов
            'CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)',
            'CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component)',
            'CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)',

            // Индексы для статистики публикаций
            'CREATE INDEX IF NOT EXISTS idx_publication_stats_channel_id ON publication_stats(channel_id)',
            'CREATE INDEX IF NOT EXISTS idx_publication_stats_published_date ON publication_stats(published_date)'
        ];

        for (const index of newIndexes) {
            try {
                await this.database.run(index);
                const indexName = index.match(/CREATE INDEX IF NOT EXISTS (\w+)/)[1];
                this.logger.info(`  ✅ Создан индекс: ${indexName}`);
            } catch (error) {
                this.logger.error(`  ❌ Ошибка создания индекса: ${error.message}`);
            }
        }
    }

    /**
     * Обновление настроек
     */
    async updateSettings() {
        this.logger.info('⚙️ Обновление настроек...');

        const newSettings = [
            ['content_processing_batch_size', '50', 'Размер пакета для обработки контента'],
            ['scoring_threshold_high', '20', 'Порог высокого качества (уровень A)'],
            ['scoring_threshold_medium', '15', 'Порог среднего качества (уровень B)'],
            ['scoring_threshold_low', '10', 'Порог низкого качества (уровень C)'],
            ['max_posts_per_specialization', '5', 'Максимум постов на специальность в день'],
            ['moderation_session_duration', '120', 'Длительность сессии премодерации (минуты)'],
            ['revision_session_frequency', '3', 'Частота сессий доработки (дни)'],
            ['telegram_posting_schedule', '8:00,14:00,20:00', 'Расписание публикации в Telegram'],
            ['content_retention_processed', '90', 'Срок хранения обработанного контента (дни)'],
            ['content_retention_scored', '180', 'Срок хранения оцененного контента (дни)'],
            ['duplicate_threshold', '0.85', 'Порог схожести для дедупликации'],
            ['max_content_length', '50000', 'Максимальная длина контента'],
            ['min_content_length', '100', 'Минимальная длина контента'],
            ['supported_languages', 'ru,en', 'Поддерживаемые языки'],
            ['quality_score_weights', '{"scientificBasis":0.4,"relevance":0.35,"practicality":0.25}', 'Веса для скоринга качества']
        ];

        for (const [key, value, description] of newSettings) {
            try {
                await this.database.run(
                    'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
                    [key, value, description]
                );
                this.logger.info(`  ✅ Настройка: ${key}`);
            } catch (error) {
                this.logger.error(`  ❌ Ошибка настройки ${key}: ${error.message}`);
            }
        }
    }

    /**
     * Проверка целостности схемы
     */
    async validateSchema() {
        this.logger.info('🔍 Проверка целостности схемы...');

        try {
            // Проверяем существование всех таблиц
            const requiredTables = [
                'sources', 'articles', 'posts', 'scoring', 'metrics', 'settings',
                'moderation_queue', 'revision_queue', 'specialization_metrics',
                'system_logs', 'telegram_config', 'publication_stats'
            ];

            for (const table of requiredTables) {
                const result = await this.database.get(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                    [table]
                );
                
                if (result) {
                    this.logger.info(`  ✅ Таблица ${table} существует`);
                } else {
                    this.logger.error(`  ❌ Таблица ${table} не найдена`);
                }
            }

            // Проверяем ключевые колонки
            const criticalColumns = [
                { table: 'articles', column: 'content_hash' },
                { table: 'articles', column: 'language' },
                { table: 'articles', column: 'content_type' },
                { table: 'posts', column: 'specialization' },
                { table: 'posts', column: 'moderation_status' },
                { table: 'scoring', column: 'scientific_basis' },
                { table: 'scoring', column: 'relevance' },
                { table: 'scoring', column: 'practicality' }
            ];

            for (const { table, column } of criticalColumns) {
                const result = await this.database.get(
                    `PRAGMA table_info(${table}) WHERE name=?`,
                    [column]
                );
                
                if (result) {
                    this.logger.info(`  ✅ Колонка ${table}.${column} существует`);
                } else {
                    this.logger.error(`  ❌ Колонка ${table}.${column} не найдена`);
                }
            }

            this.logger.info('✅ Проверка целостности завершена');

        } catch (error) {
            this.logger.error('❌ Ошибка при проверке целостности:', error);
        }
    }

    /**
     * Создание резервной копии перед обновлением
     */
    async createBackup() {
        try {
            const backupPath = path.join(__dirname, '../data/backup_' + Date.now() + '.db');
            await this.database.backup(backupPath);
            this.logger.info(`💾 Резервная копия создана: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.error('❌ Ошибка создания резервной копии:', error);
            throw error;
        }
    }

    /**
     * Запуск обновления
     */
    async run() {
        try {
            const args = process.argv.slice(2);
            
            if (args.includes('--backup')) {
                await this.createBackup();
            }
            
            await this.updateSchema();
            await this.validateSchema();
            
            this.logger.info('🎉 Обновление схемы базы данных завершено успешно!');
            
        } catch (error) {
            this.logger.error('💥 Критическая ошибка при обновлении схемы:', error);
            process.exit(1);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const updater = new DatabaseSchemaUpdater();
    updater.run();
}

module.exports = DatabaseSchemaUpdater;
