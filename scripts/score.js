#!/usr/bin/env node

/**
 * Система скоринга медицинского контента
 * Оценивает качество, актуальность и практическую применимость статей
 */

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');
const moment = require('moment');

class ContentScorer {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        
        // Веса для разных критериев
        this.weights = {
            scientificBasis: 0.4,    // 40% - Научная обоснованность
            relevance: 0.35,         // 35% - Актуальность
            practicality: 0.25       // 25% - Практическая применимость
        };
    }

    /**
     * Основной метод скоринга контента
     */
    async scoreContent() {
        try {
            this.logger.info('Начинаем скоринг контента...');

            // Получаем обработанные статьи без скоринга
            const articles = await this.database.getUnscoredArticles();
            
            if (articles.length === 0) {
                this.logger.info('Нет статей для скоринга');
                return;
            }

            this.logger.info(`Найдено ${articles.length} статей для скоринга`);

            let scoredCount = 0;
            let skippedCount = 0;

            // Скорим каждую статью
            for (const article of articles) {
                try {
                    const score = await this.scoreArticle(article);
                    
                    if (score) {
                        await this.database.saveArticleScore(article.id, score);
                        scoredCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    this.logger.error(`Ошибка при скоринге статьи ${article.id}:`, error);
                    skippedCount++;
                }
            }

            this.logger.info(`Скоринг завершен: ${scoredCount} оценено, ${skippedCount} пропущено`);

        } catch (error) {
            this.logger.error('Ошибка при скоринге контента:', error);
        }
    }

    /**
     * Скоринг одной статьи
     */
    async scoreArticle(article) {
        try {
            // 1. Научная обоснованность (0-10 баллов)
            const scientificScore = this.scoreScientificBasis(article);
            
            // 2. Актуальность (0-8 баллов)
            const relevanceScore = this.scoreRelevance(article);
            
            // 3. Практическая применимость (0-7 баллов)
            const practicalityScore = this.scorePracticality(article);

            // 4. Итоговый скоринг
            const totalScore = this.calculateTotalScore(scientificScore, relevanceScore, practicalityScore);

            // 5. Определение уровня качества
            const qualityLevel = this.determineQualityLevel(totalScore);

            const score = {
                article_id: article.id,
                scientific_basis: scientificScore,
                relevance: relevanceScore,
                practicality: practicalityScore,
                total_score: totalScore,
                quality_level: qualityLevel,
                scored_date: new Date(),
                
                // Детальная разбивка
                breakdown: {
                    source_quality: this.assessSourceQuality(article.source_name),
                    evidence_level: this.assessEvidenceLevel(article.content_type, article.content),
                    freshness: this.assessFreshness(article.published_date),
                    clinical_applicability: this.assessClinicalApplicability(article.content),
                    methodology_quality: this.assessMethodologyQuality(article.content)
                }
            };

            return score;

        } catch (error) {
            this.logger.error(`Ошибка при скоринге статьи ${article.id}:`, error);
            return null;
        }
    }

    /**
     * Оценка научной обоснованности (0-10 баллов)
     */
    scoreScientificBasis(article) {
        let score = 0;

        // 1. Качество источника (0-3 балла)
        const sourceQuality = this.assessSourceQuality(article.source_name);
        score += sourceQuality;

        // 2. Уровень доказательности (0-2 балла)
        const evidenceLevel = this.assessEvidenceLevel(article.content_type, article.content);
        score += evidenceLevel;

        // 3. Рецензирование (0-2 балла)
        const peerReview = this.assessPeerReview(article.source_name, article.content);
        score += peerReview;

        // 4. Методология (0-3 балла)
        const methodology = this.assessMethodologyQuality(article.content);
        score += methodology;

        return Math.min(score, 10);
    }

    /**
     * Оценка актуальности (0-8 баллов)
     */
    scoreRelevance(article) {
        let score = 0;

        // 1. Свежесть публикации (0-3 балла)
        const freshness = this.assessFreshness(article.published_date);
        score += freshness;

        // 2. Тематическая актуальность (0-3 балла)
        const topicalRelevance = this.assessTopicalRelevance(article.content, article.keywords);
        score += topicalRelevance;

        // 3. Клиническая значимость (0-2 балла)
        const clinicalSignificance = this.assessClinicalSignificance(article.content);
        score += clinicalSignificance;

        return Math.min(score, 8);
    }

    /**
     * Оценка практической применимости (0-7 баллов)
     */
    scorePracticality(article) {
        let score = 0;

        // 1. Клиническая применимость (0-3 балла)
        const clinicalApplicability = this.assessClinicalApplicability(article.content);
        score += clinicalApplicability;

        // 2. Четкость рекомендаций (0-2 балла)
        const recommendationClarity = this.assessRecommendationClarity(article.content);
        score += recommendationClarity;

        // 3. Доступность для практики (0-2 балла)
        const practiceAccessibility = this.assessPracticeAccessibility(article.content);
        score += practiceAccessibility;

        return Math.min(score, 7);
    }

    /**
     * Оценка качества источника
     */
    assessSourceQuality(sourceName) {
        const sourceTiers = {
            // Уровень A (3 балла) - Топ-журналы и общества
            'A': [
                'nejm', 'lancet', 'jama', 'bmj', 'nature', 'science',
                'acc', 'aha', 'aap', 'aace', 'acog', 'aan', 'aga',
                'endocrine society', 'american diabetes association',
                'european society', 'american college'
            ],
            // Уровень B (2 балла) - Хорошие источники
            'B': [
                'medscape', 'healio', 'cochrane', 'pubmed',
                'mayo clinic', 'cleveland clinic', 'johns hopkins'
            ],
            // Уровень C (1 балл) - Обычные источники
            'C': [
                'telegram', 'rss', 'news', 'blog'
            ]
        };

        const lowerSourceName = sourceName.toLowerCase();
        
        for (const [tier, sources] of Object.entries(sourceTiers)) {
            if (sources.some(source => lowerSourceName.includes(source))) {
                return tier === 'A' ? 3 : tier === 'B' ? 2 : 1;
            }
        }

        return 1; // По умолчанию
    }

    /**
     * Оценка уровня доказательности
     */
    assessEvidenceLevel(contentType, content) {
        const lowerContent = content.toLowerCase();
        
        // Мета-анализы и систематические обзоры
        if (lowerContent.includes('meta-analysis') || lowerContent.includes('систематический обзор') ||
            lowerContent.includes('cochrane') || lowerContent.includes('systematic review')) {
            return 2;
        }
        
        // Рандомизированные контролируемые исследования
        if (lowerContent.includes('randomized controlled trial') || lowerContent.includes('ркт') ||
            lowerContent.includes('rct') || lowerContent.includes('рандомизированное')) {
            return 2;
        }
        
        // Когортные исследования
        if (lowerContent.includes('cohort study') || lowerContent.includes('когортное исследование') ||
            lowerContent.includes('prospective study') || lowerContent.includes('проспективное')) {
            return 1;
        }
        
        // Клинические рекомендации
        if (contentType === 'guideline' || lowerContent.includes('guideline') || 
            lowerContent.includes('рекомендации') || lowerContent.includes('consensus')) {
            return 2;
        }
        
        // Исследования
        if (contentType === 'research' || lowerContent.includes('study') || 
            lowerContent.includes('исследование')) {
            return 1;
        }
        
        return 0;
    }

    /**
     * Оценка рецензирования
     */
    assessPeerReview(sourceName, content) {
        const peerReviewedSources = [
            'nejm', 'lancet', 'jama', 'bmj', 'nature', 'science',
            'acc', 'aha', 'aap', 'aace', 'acog', 'aan'
        ];
        
        const lowerSourceName = sourceName.toLowerCase();
        
        if (peerReviewedSources.some(source => lowerSourceName.includes(source))) {
            return 2;
        }
        
        // Проверяем упоминание рецензирования в тексте
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('peer review') || lowerContent.includes('рецензирование') ||
            lowerContent.includes('reviewed') || lowerContent.includes('рецензировано')) {
            return 1;
        }
        
        return 0;
    }

    /**
     * Оценка качества методологии
     */
    assessMethodologyQuality(content) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Упоминание методологии
        if (lowerContent.includes('methodology') || lowerContent.includes('методология') ||
            lowerContent.includes('methods') || lowerContent.includes('методы')) {
            score += 1;
        }
        
        // Статистические данные
        if (lowerContent.includes('p-value') || lowerContent.includes('confidence interval') ||
            lowerContent.includes('statistical') || lowerContent.includes('статистически')) {
            score += 1;
        }
        
        // Размер выборки
        if (lowerContent.includes('sample size') || lowerContent.includes('размер выборки') ||
            lowerContent.includes('n=') || lowerContent.includes('участников')) {
            score += 1;
        }
        
        return Math.min(score, 3);
    }

    /**
     * Оценка свежести публикации
     */
    assessFreshness(publishedDate) {
        const now = moment();
        const published = moment(publishedDate);
        const daysDiff = now.diff(published, 'days');
        
        if (daysDiff <= 7) return 3;      // Очень свежая (неделя)
        if (daysDiff <= 30) return 2;     // Свежая (месяц)
        if (daysDiff <= 90) return 1;     // Умеренно свежая (3 месяца)
        return 0;                         // Старая
    }

    /**
     * Оценка тематической актуальности
     */
    assessTopicalRelevance(content, keywords) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Актуальные медицинские темы
        const currentTopics = [
            'covid', 'коронавирус', 'вакцина', 'vaccine',
            'искусственный интеллект', 'ai', 'машинное обучение',
            'персонализированная медицина', 'precision medicine',
            'телемедицина', 'telemedicine', 'цифровое здоровье'
        ];
        
        currentTopics.forEach(topic => {
            if (lowerContent.includes(topic)) {
                score += 1;
            }
        });
        
        // Ключевые слова
        if (keywords && keywords.length > 5) {
            score += 1;
        }
        
        return Math.min(score, 3);
    }

    /**
     * Оценка клинической значимости
     */
    assessClinicalSignificance(content) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Клинически значимые термины
        const clinicalTerms = [
            'клинически значимый', 'clinically significant',
            'практическое применение', 'clinical practice',
            'рекомендации', 'recommendations',
            'протокол', 'protocol', 'алгоритм', 'algorithm'
        ];
        
        clinicalTerms.forEach(term => {
            if (lowerContent.includes(term)) {
                score += 1;
            }
        });
        
        return Math.min(score, 2);
    }

    /**
     * Оценка клинической применимости
     */
    assessClinicalApplicability(content) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Практические рекомендации
        if (lowerContent.includes('рекомендации') || lowerContent.includes('recommendations') ||
            lowerContent.includes('протокол') || lowerContent.includes('protocol')) {
            score += 1;
        }
        
        // Дозировки и схемы
        if (lowerContent.includes('дозировка') || lowerContent.includes('dose') ||
            lowerContent.includes('схема') || lowerContent.includes('regimen')) {
            score += 1;
        }
        
        // Противопоказания и побочные эффекты
        if (lowerContent.includes('противопоказания') || lowerContent.includes('contraindications') ||
            lowerContent.includes('побочные эффекты') || lowerContent.includes('side effects')) {
            score += 1;
        }
        
        return Math.min(score, 3);
    }

    /**
     * Оценка четкости рекомендаций
     */
    assessRecommendationClarity(content) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Четкие формулировки
        if (lowerContent.includes('рекомендуется') || lowerContent.includes('recommended') ||
            lowerContent.includes('следует') || lowerContent.includes('should')) {
            score += 1;
        }
        
        // Конкретные указания
        if (lowerContent.includes('конкретно') || lowerContent.includes('specifically') ||
            lowerContent.includes('точно') || lowerContent.includes('exactly')) {
            score += 1;
        }
        
        return Math.min(score, 2);
    }

    /**
     * Оценка доступности для практики
     */
    assessPracticeAccessibility(content) {
        const lowerContent = content.toLowerCase();
        let score = 0;
        
        // Простота внедрения
        if (lowerContent.includes('просто') || lowerContent.includes('simple') ||
            lowerContent.includes('легко') || lowerContent.includes('easy')) {
            score += 1;
        }
        
        // Доступность ресурсов
        if (lowerContent.includes('доступно') || lowerContent.includes('available') ||
            lowerContent.includes('недорого') || lowerContent.includes('affordable')) {
            score += 1;
        }
        
        return Math.min(score, 2);
    }

    /**
     * Расчет итогового скоринга
     */
    calculateTotalScore(scientificScore, relevanceScore, practicalityScore) {
        const weightedScore = 
            (scientificScore * this.weights.scientificBasis) +
            (relevanceScore * this.weights.relevance) +
            (practicalityScore * this.weights.practicality);
        
        // Нормализация к шкале 0-25
        const maxPossibleScore = (10 * this.weights.scientificBasis) + 
                                (8 * this.weights.relevance) + 
                                (7 * this.weights.practicality);
        
        return Math.round((weightedScore / maxPossibleScore) * 25);
    }

    /**
     * Определение уровня качества
     */
    determineQualityLevel(totalScore) {
        if (totalScore >= 20) return 'A';      // Высокое качество
        if (totalScore >= 15) return 'B';      // Хорошее качество
        if (totalScore >= 10) return 'C';      // Удовлетворительное качество
        return 'D';                            // Низкое качество
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            await this.scoreContent();
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса скоринга:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const scorer = new ContentScorer();
    scorer.run();
}

module.exports = ContentScorer;
