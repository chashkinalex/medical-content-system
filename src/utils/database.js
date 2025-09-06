const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Модуль для работы с базой данных
 */
class Database {
    constructor() {
        this.db = null;
        this.logger = null;
    }

    /**
     * Инициализация базы данных
     */
    async initialize(databaseUrl) {
        try {
            // Создание директории для базы данных
            const dbDir = path.dirname(databaseUrl.replace('sqlite:', ''));
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            const dbPath = databaseUrl.replace('sqlite:', '');
            this.db = new sqlite3.Database(dbPath);
            
            // Инициализация логгера
            const Logger = require('./logger');
            this.logger = new Logger();

            await this.createTables();
            this.logger.success('База данных инициализирована', { path: dbPath });
        } catch (error) {
            if (this.logger) {
                this.logger.error('Ошибка инициализации базы данных:', error);
            }
            throw error;
        }
    }

    /**
     * Создание таблиц
     */
    async createTables() {
        const tables = [
            // Таблица источников контента
            `CREATE TABLE IF NOT EXISTS sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                type TEXT NOT NULL,
                level TEXT NOT NULL,
                specialization TEXT,
                language TEXT DEFAULT 'en',
                enabled BOOLEAN DEFAULT 1,
                last_checked DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Таблица статей
            `CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id INTEGER,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                summary TEXT,
                content TEXT,
                authors TEXT,
                journal TEXT,
                published_date DATETIME,
                collected_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                processed BOOLEAN DEFAULT 0,
                scored BOOLEAN DEFAULT 0,
                score INTEGER DEFAULT 0,
                max_score INTEGER DEFAULT 25,
                status TEXT DEFAULT 'collected',
                tags TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_id) REFERENCES sources (id),
                UNIQUE(url)
            )`,

            // Таблица постов
            `CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER,
                template_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                status TEXT DEFAULT 'generated',
                scheduled_date DATETIME,
                published_date DATETIME,
                telegram_message_id INTEGER,
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                shares INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles (id)
            )`,

            // Таблица скоринга
            `CREATE TABLE IF NOT EXISTS scoring (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER,
                clinical_significance INTEGER DEFAULT 0,
                evidence_quality INTEGER DEFAULT 0,
                novelty INTEGER DEFAULT 0,
                applicability INTEGER DEFAULT 0,
                controversy INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                max_score INTEGER DEFAULT 25,
                scorer_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles (id)
            )`,

            // Таблица метрик
            `CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE NOT NULL,
                articles_collected INTEGER DEFAULT 0,
                articles_processed INTEGER DEFAULT 0,
                articles_scored INTEGER DEFAULT 0,
                posts_generated INTEGER DEFAULT 0,
                posts_published INTEGER DEFAULT 0,
                average_score REAL DEFAULT 0,
                top_sources TEXT,
                top_topics TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date)
            )`,

            // Таблица настроек
            `CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        // Создание индексов
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id)',
            'CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles(published_date)',
            'CREATE INDEX IF NOT EXISTS idx_articles_score ON articles(score)',
            'CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)',
            'CREATE INDEX IF NOT EXISTS idx_posts_article_id ON posts(article_id)',
            'CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)',
            'CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON posts(scheduled_date)',
            'CREATE INDEX IF NOT EXISTS idx_scoring_article_id ON scoring(article_id)',
            'CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(date)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }

        // Вставка начальных настроек
        await this.insertDefaultSettings();
    }

    /**
     * Вставка настроек по умолчанию
     */
    async insertDefaultSettings() {
        const defaultSettings = [
            ['scoring_threshold', '14', 'Минимальный балл для публикации'],
            ['scoring_max', '25', 'Максимальный балл скоринга'],
            ['publication_schedule', '0 9,15,21 * * *', 'Расписание публикации'],
            ['rss_update_interval', '3600000', 'Интервал обновления RSS (мс)'],
            ['max_articles_per_run', '50', 'Максимум статей за один запуск'],
            ['content_retention_days', '30', 'Срок хранения контента (дни)']
        ];

        for (const [key, value, description] of defaultSettings) {
            await this.run(
                'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
                [key, value, description]
            );
        }
    }

    /**
     * Выполнение SQL запроса
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.run(sql, params, function(err) {
                const duration = Date.now() - startTime;
                if (err) {
                    if (this.logger) {
                        this.logger.error('Ошибка выполнения SQL:', err, { sql, params });
                    }
                    reject(err);
                } else {
                    if (this.logger) {
                        this.logger.database('RUN', sql.split(' ')[0], duration, { 
                            changes: this.changes,
                            lastID: this.lastID 
                        });
                    }
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            }.bind(this));
        });
    }

    /**
     * Получение одной записи
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.get(sql, params, (err, row) => {
                const duration = Date.now() - startTime;
                if (err) {
                    if (this.logger) {
                        this.logger.error('Ошибка получения записи:', err, { sql, params });
                    }
                    reject(err);
                } else {
                    if (this.logger) {
                        this.logger.database('GET', sql.split(' ')[0], duration);
                    }
                    resolve(row);
                }
            });
        });
    }

    /**
     * Получение всех записей
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.all(sql, params, (err, rows) => {
                const duration = Date.now() - startTime;
                if (err) {
                    if (this.logger) {
                        this.logger.error('Ошибка получения записей:', err, { sql, params });
                    }
                    reject(err);
                } else {
                    if (this.logger) {
                        this.logger.database('ALL', sql.split(' ')[0], duration, { count: rows.length });
                    }
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Получение настройки
     */
    async getSetting(key) {
        const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
        return row ? row.value : null;
    }

    /**
     * Установка настройки
     */
    async setSetting(key, value, description = null) {
        await this.run(
            'INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [key, value, description]
        );
    }

    /**
     * Получение статистики
     */
    async getStats() {
        const stats = {};
        
        // Общая статистика
        stats.totalArticles = await this.get('SELECT COUNT(*) as count FROM articles');
        stats.totalPosts = await this.get('SELECT COUNT(*) as count FROM posts');
        stats.publishedPosts = await this.get('SELECT COUNT(*) as count FROM posts WHERE status = "published"');
        
        // Статистика по источникам
        stats.articlesBySource = await this.all(`
            SELECT s.name, COUNT(a.id) as count 
            FROM sources s 
            LEFT JOIN articles a ON s.id = a.source_id 
            GROUP BY s.id, s.name 
            ORDER BY count DESC
        `);
        
        // Статистика по скорингу
        stats.averageScore = await this.get(`
            SELECT AVG(score) as avg_score 
            FROM articles 
            WHERE scored = 1 AND score > 0
        `);
        
        // Статистика за последние 7 дней
        stats.recentActivity = await this.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as articles_collected
            FROM articles 
            WHERE created_at >= datetime('now', '-7 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);
        
        return stats;
    }

    /**
     * Очистка старых данных
     */
    async cleanup(retentionDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        const result = await this.run(
            'DELETE FROM articles WHERE created_at < ? AND status = "archived"',
            [cutoffDate.toISOString()]
        );
        
        if (this.logger) {
            this.logger.info(`Очищено ${result.changes} старых статей`);
        }
        
        return result.changes;
    }

    /**
     * Резервное копирование
     */
    async backup(backupPath) {
        return new Promise((resolve, reject) => {
            this.db.backup(backupPath, (err) => {
                if (err) {
                    if (this.logger) {
                        this.logger.error('Ошибка резервного копирования:', err);
                    }
                    reject(err);
                } else {
                    if (this.logger) {
                        this.logger.success('Резервная копия создана', { path: backupPath });
                    }
                    resolve();
                }
            });
        });
    }

    /**
     * Получение необработанных статей
     */
    async getRawArticles() {
        return await this.all(`
            SELECT * FROM articles 
            WHERE processed = 0 AND status = 'collected'
            ORDER BY collected_date ASC
        `);
    }

    /**
     * Получение неоцененных статей
     */
    async getUnscoredArticles() {
        return await this.all(`
            SELECT * FROM articles 
            WHERE scored = 0 AND processed = 1 AND status = 'processed'
            ORDER BY processed_date ASC
        `);
    }

    /**
     * Получение статей для генерации постов
     */
    async getArticlesForPostGeneration() {
        return await this.all(`
            SELECT a.*, s.total_score, s.quality_level
            FROM articles a
            LEFT JOIN scoring s ON a.id = s.article_id
            WHERE a.scored = 1 AND s.total_score >= 15 AND a.status = 'scored'
            ORDER BY s.total_score DESC, a.published_date DESC
        `);
    }

    /**
     * Получение постов для премодерации
     */
    async getPostsForModeration() {
        return await this.all(`
            SELECT p.*, a.title as article_title, a.source_name
            FROM posts p
            LEFT JOIN articles a ON p.article_id = a.id
            WHERE p.moderation_status = 'pending'
            ORDER BY p.generated_date ASC
        `);
    }

    /**
     * Получение постов для премодерации по специальности
     */
    async getPostsForModerationBySpecialization(specialization) {
        return await this.all(`
            SELECT p.*, a.title as article_title, a.source_name
            FROM posts p
            LEFT JOIN articles a ON p.article_id = a.id
            WHERE p.moderation_status = 'pending' AND p.specialization = ?
            ORDER BY p.generated_date ASC
        `, [specialization]);
    }

    /**
     * Получение одобренных постов для публикации
     */
    async getApprovedPostsForPublishing(contentTypes = []) {
        let sql = `
            SELECT p.*, a.title as article_title, a.source_name
            FROM posts p
            LEFT JOIN articles a ON p.article_id = a.id
            WHERE p.moderation_status = 'approved' AND p.status = 'generated'
        `;
        
        if (contentTypes.length > 0) {
            const placeholders = contentTypes.map(() => '?').join(',');
            sql += ` AND p.post_type IN (${placeholders})`;
        }
        
        sql += ` ORDER BY p.generated_date ASC`;
        
        return await this.all(sql, contentTypes);
    }

    /**
     * Получение постов для доработки
     */
    async getPostsForRevision() {
        return await this.all(`
            SELECT p.*, a.title as article_title, a.source_name
            FROM posts p
            LEFT JOIN articles a ON p.article_id = a.id
            WHERE p.moderation_status = 'revision' AND p.revision_status = 'pending'
            ORDER BY p.decision_date ASC
        `);
    }

    /**
     * Сохранение обработанной статьи
     */
    async saveProcessedArticle(article) {
        return await this.run(`
            UPDATE articles SET
                title = ?, content = ?, summary = ?, authors = ?, keywords = ?,
                language = ?, content_type = ?, content_category = ?, quality_score = ?,
                content_hash = ?, word_count = ?, reading_time = ?, processed_date = ?,
                processed = 1, status = 'processed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            article.title, article.content, article.summary, 
            JSON.stringify(article.authors), JSON.stringify(article.keywords),
            article.language, article.content_type, article.content_category, article.quality_score,
            article.content_hash, article.word_count, article.reading_time, article.processed_date,
            article.id
        ]);
    }

    /**
     * Сохранение скоринга статьи
     */
    async saveArticleScore(articleId, score) {
        return await this.run(`
            INSERT OR REPLACE INTO scoring (
                article_id, scientific_basis, relevance, practicality, total_score,
                quality_level, breakdown, source_quality, evidence_level, freshness,
                clinical_applicability, methodology_quality, scored_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            articleId, score.scientific_basis, score.relevance, score.practicality, score.total_score,
            score.quality_level, JSON.stringify(score.breakdown), score.breakdown.source_quality,
            score.breakdown.evidence_level, score.breakdown.freshness, score.breakdown.clinical_applicability,
            score.breakdown.methodology_quality
        ]);
    }

    /**
     * Сохранение сгенерированного поста
     */
    async saveGeneratedPost(post) {
        return await this.run(`
            INSERT INTO posts (
                article_id, specialization, post_type, title, content, summary,
                key_points, practical_application, source_name, source_url, score,
                generated_date, status, moderation_status, hashtags, word_count, reading_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', 'pending', ?, ?, ?)
        `, [
            post.article_id, post.specialization, post.post_type, post.title, post.content, post.summary,
            JSON.stringify(post.key_points), post.practical_application, post.source_name, post.source_url, post.score,
            post.generated_date, JSON.stringify(post.hashtags), post.word_count, post.reading_time
        ]);
    }

    /**
     * Обновление статуса премодерации поста
     */
    async updatePostModerationStatus(postId, decision, moderatorId) {
        return await this.run(`
            UPDATE posts SET
                moderation_status = ?, moderator_decision = ?, decision_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [decision, decision, postId]);
    }

    /**
     * Сохранение комментария для доработки
     */
    async saveRevisionComment(postId, comment, moderatorId) {
        return await this.run(`
            UPDATE posts SET
                revision_comment = ?, revision_status = 'pending', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [comment, postId]);
    }

    /**
     * Обновление статуса публикации поста
     */
    async updatePostPublishingStatus(postId, status, messageId) {
        return await this.run(`
            UPDATE posts SET
                status = ?, telegram_message_id = ?, published_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, messageId, postId]);
    }

    /**
     * Обновление доработанного поста
     */
    async updateRevisedPost(postId, revisedContent) {
        return await this.run(`
            UPDATE posts SET
                content = ?, revision_status = 'completed', completed_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [revisedContent, postId]);
    }

    /**
     * Получение статистики премодерации
     */
    async getModerationStats() {
        const stats = await this.get(`
            SELECT 
                COUNT(CASE WHEN moderation_status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN moderation_status = 'revision' THEN 1 END) as revision,
                COUNT(*) as total_week
            FROM posts 
            WHERE generated_date >= datetime('now', '-7 days')
        `);

        const approvalRate = stats.total_week > 0 ? 
            Math.round((stats.approved / stats.total_week) * 100) : 0;

        return {
            ...stats,
            approval_rate: approvalRate,
            specializations: 7 // Количество специальностей
        };
    }

    /**
     * Получение тестовых источников
     */
    async getTestSources(limit = 3) {
        return await this.all(`
            SELECT * FROM sources 
            WHERE enabled = 1 
            ORDER BY RANDOM() 
            LIMIT ?
        `, [limit]);
    }

    /**
     * Получение количества необработанных статей
     */
    async getRawArticlesCount() {
        const result = await this.get('SELECT COUNT(*) as count FROM articles WHERE processed = 0');
        return result.count;
    }

    /**
     * Получение количества обработанных статей
     */
    async getProcessedArticlesCount() {
        const result = await this.get('SELECT COUNT(*) as count FROM articles WHERE processed = 1');
        return result.count;
    }

    /**
     * Получение количества оцененных статей
     */
    async getScoredArticlesCount() {
        const result = await this.get('SELECT COUNT(*) as count FROM articles WHERE scored = 1');
        return result.count;
    }

    /**
     * Получение количества сгенерированных постов
     */
    async getGeneratedPostsCount() {
        const result = await this.get('SELECT COUNT(*) as count FROM posts WHERE status = "generated"');
        return result.count;
    }

    /**
     * Получение постов по специальностям
     */
    async getPostsBySpecialization() {
        const results = await this.all(`
            SELECT specialization, COUNT(*) as count 
            FROM posts 
            WHERE status = 'generated'
            GROUP BY specialization
        `);
        
        const stats = {};
        results.forEach(row => {
            stats[row.specialization] = row.count;
        });
        
        return stats;
    }

    /**
     * Получение распределения скоринга
     */
    async getScoreDistribution() {
        const results = await this.all(`
            SELECT quality_level, COUNT(*) as count 
            FROM scoring 
            GROUP BY quality_level
        `);
        
        const stats = {};
        results.forEach(row => {
            stats[row.quality_level] = row.count;
        });
        
        return stats;
    }

    /**
     * Очистка тестовых данных
     */
    async cleanupTestData() {
        await this.run('DELETE FROM posts WHERE status = "generated"');
        await this.run('DELETE FROM scoring WHERE article_id IN (SELECT id FROM articles WHERE processed = 1)');
        await this.run('DELETE FROM articles WHERE processed = 1');
        this.logger.info('Тестовые данные очищены');
    }

    /**
     * Поиск статьи по URL
     */
    async findArticleByUrl(url) {
        return await this.get('SELECT * FROM articles WHERE url = ?', [url]);
    }

    /**
     * Поиск статьи по хешу
     */
    async findArticleByHash(contentHash) {
        return await this.get('SELECT * FROM articles WHERE content_hash = ?', [contentHash]);
    }

    /**
     * Поиск похожих заголовков
     */
    async findSimilarTitles(title) {
        return await this.all(`
            SELECT title FROM articles 
            WHERE title != ? AND published_date >= datetime('now', '-30 days')
            LIMIT 10
        `, [title]);
    }

    /**
     * Закрытие соединения с базой данных
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        if (this.logger) {
                            this.logger.error('Ошибка закрытия базы данных:', err);
                        }
                        reject(err);
                    } else {
                        if (this.logger) {
                            this.logger.info('Соединение с базой данных закрыто');
                        }
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;
