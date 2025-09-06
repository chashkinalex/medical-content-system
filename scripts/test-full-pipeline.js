#!/usr/bin/env node

/**
 * Тестирование полного пайплайна обработки контента
 * Проверяет все этапы: сбор → обработка → скоринг → генерация
 */

const ContentCollector = require('../src/collectors/content-collector');
const ContentProcessor = require('./process');
const ContentScorer = require('./score');
const PostGenerator = require('./generate');
const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

class PipelineTester {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        this.collector = new ContentCollector();
        this.processor = new ContentProcessor();
        this.scorer = new ContentScorer();
        this.generator = new PostGenerator();
    }

    /**
     * Тестирование полного пайплайна
     */
    async testFullPipeline() {
        try {
            this.logger.info('🧪 Начинаем тестирование полного пайплайна...');
            
            // Инициализация базы данных
            await this.database.initialize();
            
            // Этап 1: Сбор контента
            await this.testContentCollection();
            
            // Этап 2: Обработка контента
            await this.testContentProcessing();
            
            // Этап 3: Скоринг контента
            await this.testContentScoring();
            
            // Этап 4: Генерация постов
            await this.testPostGeneration();
            
            // Финальная статистика
            await this.showFinalStatistics();
            
            this.logger.info('✅ Тестирование полного пайплайна завершено успешно!');
            
        } catch (error) {
            this.logger.error('❌ Ошибка при тестировании пайплайна:', error);
        }
    }

    /**
     * Тестирование сбора контента
     */
    async testContentCollection() {
        this.logger.info('📥 Этап 1: Тестирование сбора контента...');
        
        try {
            // Инициализация коллектора
            await this.collector.initialize();
            
            // Сбор с ограниченного количества источников для тестирования
            const testSources = await this.database.getTestSources(3); // Берем 3 источника для теста
            
            let collectedCount = 0;
            for (const source of testSources) {
                try {
                    const result = await this.collector.collectFromSource(source);
                    if (result && result.articles && result.articles.length > 0) {
                        collectedCount += result.articles.length;
                        this.logger.info(`  ✅ ${source.name}: ${result.articles.length} статей`);
                    } else {
                        this.logger.info(`  ⚠️ ${source.name}: 0 статей`);
                    }
                } catch (error) {
                    this.logger.error(`  ❌ ${source.name}: ошибка сбора`, error.message);
                }
            }
            
            this.logger.info(`📊 Собрано статей: ${collectedCount}`);
            
        } catch (error) {
            this.logger.error('❌ Ошибка при тестировании сбора контента:', error);
        }
    }

    /**
     * Тестирование обработки контента
     */
    async testContentProcessing() {
        this.logger.info('⚙️ Этап 2: Тестирование обработки контента...');
        
        try {
            // Получаем необработанные статьи
            const rawArticles = await this.database.getRawArticles();
            this.logger.info(`📊 Найдено необработанных статей: ${rawArticles.length}`);
            
            if (rawArticles.length === 0) {
                this.logger.info('⚠️ Нет необработанных статей для тестирования');
                return;
            }
            
            // Обрабатываем первые 5 статей для тестирования
            const testArticles = rawArticles.slice(0, 5);
            let processedCount = 0;
            
            for (const article of testArticles) {
                try {
                    const processedArticle = await this.processor.processArticle(article);
                    if (processedArticle) {
                        await this.database.saveProcessedArticle(processedArticle);
                        processedCount++;
                        this.logger.info(`  ✅ Статья ${article.id}: обработана`);
                    } else {
                        this.logger.info(`  ⚠️ Статья ${article.id}: пропущена`);
                    }
                } catch (error) {
                    this.logger.error(`  ❌ Статья ${article.id}: ошибка обработки`, error.message);
                }
            }
            
            this.logger.info(`📊 Обработано статей: ${processedCount}`);
            
        } catch (error) {
            this.logger.error('❌ Ошибка при тестировании обработки контента:', error);
        }
    }

    /**
     * Тестирование скоринга контента
     */
    async testContentScoring() {
        this.logger.info('📊 Этап 3: Тестирование скоринга контента...');
        
        try {
            // Получаем неоцененные статьи
            const unscoredArticles = await this.database.getUnscoredArticles();
            this.logger.info(`📊 Найдено неоцененных статей: ${unscoredArticles.length}`);
            
            if (unscoredArticles.length === 0) {
                this.logger.info('⚠️ Нет неоцененных статей для тестирования');
                return;
            }
            
            // Оцениваем первые 5 статей для тестирования
            const testArticles = unscoredArticles.slice(0, 5);
            let scoredCount = 0;
            
            for (const article of testArticles) {
                try {
                    const score = await this.scorer.scoreArticle(article);
                    if (score) {
                        await this.database.saveArticleScore(article.id, score);
                        scoredCount++;
                        this.logger.info(`  ✅ Статья ${article.id}: скоринг ${score.total_score}/25 (${score.quality_level})`);
                    } else {
                        this.logger.info(`  ⚠️ Статья ${article.id}: скоринг пропущен`);
                    }
                } catch (error) {
                    this.logger.error(`  ❌ Статья ${article.id}: ошибка скоринга`, error.message);
                }
            }
            
            this.logger.info(`📊 Оценено статей: ${scoredCount}`);
            
        } catch (error) {
            this.logger.error('❌ Ошибка при тестировании скоринга контента:', error);
        }
    }

    /**
     * Тестирование генерации постов
     */
    async testPostGeneration() {
        this.logger.info('✍️ Этап 4: Тестирование генерации постов...');
        
        try {
            // Получаем статьи для генерации постов
            const articlesForGeneration = await this.database.getArticlesForPostGeneration();
            this.logger.info(`📊 Найдено статей для генерации: ${articlesForGeneration.length}`);
            
            if (articlesForGeneration.length === 0) {
                this.logger.info('⚠️ Нет статей для генерации постов');
                return;
            }
            
            // Генерируем посты для первых 3 статей
            const testArticles = articlesForGeneration.slice(0, 3);
            let generatedCount = 0;
            
            for (const article of testArticles) {
                try {
                    const specialization = this.generator.determineSpecialization(article);
                    const post = await this.generator.generatePost(article, specialization);
                    if (post) {
                        await this.database.saveGeneratedPost(post);
                        generatedCount++;
                        this.logger.info(`  ✅ Статья ${article.id} → Пост для ${specialization}`);
                    } else {
                        this.logger.info(`  ⚠️ Статья ${article.id}: генерация пропущена`);
                    }
                } catch (error) {
                    this.logger.error(`  ❌ Статья ${article.id}: ошибка генерации`, error.message);
                }
            }
            
            this.logger.info(`📊 Сгенерировано постов: ${generatedCount}`);
            
        } catch (error) {
            this.logger.error('❌ Ошибка при тестировании генерации постов:', error);
        }
    }

    /**
     * Показать финальную статистику
     */
    async showFinalStatistics() {
        this.logger.info('📈 Финальная статистика пайплайна:');
        
        try {
            // Статистика по статьям
            const rawArticlesCount = await this.database.getRawArticlesCount();
            const processedArticlesCount = await this.database.getProcessedArticlesCount();
            const scoredArticlesCount = await this.database.getScoredArticlesCount();
            
            // Статистика по постам
            const generatedPostsCount = await this.database.getGeneratedPostsCount();
            const postsBySpecialization = await this.database.getPostsBySpecialization();
            
            // Статистика по скорингу
            const scoreDistribution = await this.database.getScoreDistribution();
            
            this.logger.info(`📊 Статьи:`);
            this.logger.info(`  • Собрано: ${rawArticlesCount}`);
            this.logger.info(`  • Обработано: ${processedArticlesCount}`);
            this.logger.info(`  • Оценено: ${scoredArticlesCount}`);
            
            this.logger.info(`📊 Посты:`);
            this.logger.info(`  • Сгенерировано: ${generatedPostsCount}`);
            
            if (postsBySpecialization && Object.keys(postsBySpecialization).length > 0) {
                this.logger.info(`  • По специальностям:`);
                Object.entries(postsBySpecialization).forEach(([spec, count]) => {
                    this.logger.info(`    - ${spec}: ${count}`);
                });
            }
            
            if (scoreDistribution && Object.keys(scoreDistribution).length > 0) {
                this.logger.info(`📊 Распределение скоринга:`);
                Object.entries(scoreDistribution).forEach(([level, count]) => {
                    this.logger.info(`  • Уровень ${level}: ${count} статей`);
                });
            }
            
        } catch (error) {
            this.logger.error('❌ Ошибка при получении статистики:', error);
        }
    }

    /**
     * Очистка тестовых данных
     */
    async cleanupTestData() {
        this.logger.info('🧹 Очистка тестовых данных...');
        
        try {
            await this.database.cleanupTestData();
            this.logger.info('✅ Тестовые данные очищены');
        } catch (error) {
            this.logger.error('❌ Ошибка при очистке тестовых данных:', error);
        }
    }

    /**
     * Запуск тестирования
     */
    async run() {
        try {
            const args = process.argv.slice(2);
            
            if (args.includes('--cleanup')) {
                await this.cleanupTestData();
                return;
            }
            
            await this.testFullPipeline();
            
            if (args.includes('--cleanup-after')) {
                await this.cleanupTestData();
            }
            
        } catch (error) {
            this.logger.error('❌ Критическая ошибка при тестировании:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const tester = new PipelineTester();
    tester.run();
}

module.exports = PipelineTester;
