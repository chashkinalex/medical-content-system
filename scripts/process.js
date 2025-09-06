#!/usr/bin/env node

/**
 * Скрипт предварительной обработки медицинского контента
 * Выполняет дедупликацию, очистку текста, извлечение метаданных и классификацию
 */

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');
const cheerio = require('cheerio');
const crypto = require('crypto');
const moment = require('moment');

class ContentProcessor {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        
        // Настройки обработки
        this.settings = {
            maxContentLength: 50000, // Максимальная длина контента
            minContentLength: 100,   // Минимальная длина контента
            duplicateThreshold: 0.85, // Порог схожести для дедупликации
            supportedLanguages: ['ru', 'en'] // Поддерживаемые языки
        };
    }

    /**
     * Основной метод обработки контента
     */
    async processContent() {
        try {
            this.logger.info('Начинаем предварительную обработку контента...');

            // Получаем необработанные статьи
            const rawArticles = await this.database.getRawArticles();
            
            if (rawArticles.length === 0) {
                this.logger.info('Нет необработанных статей для обработки');
                return;
            }

            this.logger.info(`Найдено ${rawArticles.length} необработанных статей`);

            let processedCount = 0;
            let skippedCount = 0;

            // Обрабатываем каждую статью
            for (const article of rawArticles) {
                try {
                    const processedArticle = await this.processArticle(article);
                    
                    if (processedArticle) {
                        await this.database.saveProcessedArticle(processedArticle);
                        processedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    this.logger.error(`Ошибка при обработке статьи ${article.id}:`, error);
                    skippedCount++;
                }
            }

            this.logger.info(`Обработка завершена: ${processedCount} обработано, ${skippedCount} пропущено`);

        } catch (error) {
            this.logger.error('Ошибка при обработке контента:', error);
        }
    }

    /**
     * Обработка одной статьи
     */
    async processArticle(article) {
        try {
            // 1. Дедупликация
            const isDuplicate = await this.checkDuplicate(article);
            if (isDuplicate) {
                this.logger.info(`Статья ${article.id} является дубликатом, пропускаем`);
                return null;
            }

            // 2. Очистка текста
            const cleanedContent = this.cleanText(article.content);
            if (!this.validateContent(cleanedContent)) {
                this.logger.info(`Статья ${article.id} не прошла валидацию, пропускаем`);
                return null;
            }

            // 3. Извлечение метаданных
            const metadata = this.extractMetadata(article, cleanedContent);

            // 4. Классификация контента
            const classification = this.classifyContent(cleanedContent, metadata);

            // 5. Определение языка
            const language = this.detectLanguage(cleanedContent);

            // 6. Создание хеша для дедупликации
            const contentHash = this.generateContentHash(cleanedContent);

            // 7. Создание обработанной статьи
            const processedArticle = {
                id: article.id,
                source_id: article.source_id,
                title: this.cleanTitle(article.title),
                content: cleanedContent,
                summary: this.generateSummary(cleanedContent),
                url: article.url,
                published_date: article.published_date,
                processed_date: new Date(),
                
                // Метаданные
                authors: metadata.authors,
                keywords: metadata.keywords,
                language: language,
                content_type: classification.type,
                content_category: classification.category,
                
                // Технические поля
                content_hash: contentHash,
                word_count: this.countWords(cleanedContent),
                reading_time: this.calculateReadingTime(cleanedContent),
                
                // Статус
                status: 'processed',
                quality_score: this.calculateQualityScore(cleanedContent, metadata)
            };

            return processedArticle;

        } catch (error) {
            this.logger.error(`Ошибка при обработке статьи ${article.id}:`, error);
            return null;
        }
    }

    /**
     * Проверка на дубликаты
     */
    async checkDuplicate(article) {
        try {
            // Проверяем по URL
            const existingByUrl = await this.database.findArticleByUrl(article.url);
            if (existingByUrl) {
                return true;
            }

            // Проверяем по хешу контента
            const contentHash = this.generateContentHash(article.content);
            const existingByHash = await this.database.findArticleByHash(contentHash);
            if (existingByHash) {
                return true;
            }

            // Проверяем по схожести заголовков
            const similarTitles = await this.database.findSimilarTitles(article.title);
            for (const similar of similarTitles) {
                const similarity = this.calculateSimilarity(article.title, similar.title);
                if (similarity > this.settings.duplicateThreshold) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.logger.error('Ошибка при проверке дубликатов:', error);
            return false;
        }
    }

    /**
     * Очистка текста
     */
    cleanText(content) {
        if (!content) return '';

        // Удаляем HTML теги
        const $ = cheerio.load(content);
        let text = $.text();

        // Нормализация пробелов
        text = text.replace(/\s+/g, ' ').trim();

        // Удаление специальных символов
        text = text.replace(/[^\w\s\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F.,!?;:()\-]/g, ' ');

        // Нормализация пунктуации
        text = text.replace(/\s+([.,!?;:])/g, '$1');
        text = text.replace(/([.,!?;:])\s+/g, '$1 ');

        return text;
    }

    /**
     * Очистка заголовка
     */
    cleanTitle(title) {
        if (!title) return '';
        
        // Удаляем HTML теги
        const $ = cheerio.load(title);
        let cleanTitle = $.text();
        
        // Нормализация
        cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();
        
        return cleanTitle;
    }

    /**
     * Валидация контента
     */
    validateContent(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const length = content.length;
        if (length < this.settings.minContentLength || length > this.settings.maxContentLength) {
            return false;
        }

        // Проверяем на минимальное количество слов
        const wordCount = this.countWords(content);
        if (wordCount < 20) {
            return false;
        }

        return true;
    }

    /**
     * Извлечение метаданных
     */
    extractMetadata(article, content) {
        const metadata = {
            authors: [],
            keywords: [],
            source_name: article.source_name || 'Unknown',
            source_url: article.source_url || article.url
        };

        // Извлечение авторов (если есть)
        if (article.authors) {
            metadata.authors = Array.isArray(article.authors) ? article.authors : [article.authors];
        }

        // Извлечение ключевых слов
        metadata.keywords = this.extractKeywords(content);

        return metadata;
    }

    /**
     * Извлечение ключевых слов
     */
    extractKeywords(content) {
        const words = content.toLowerCase()
            .replace(/[^\w\s\u0400-\u04FF]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        // Подсчет частоты слов
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Сортировка по частоте и возврат топ-10
        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
    }

    /**
     * Классификация контента
     */
    classifyContent(content, metadata) {
        const classification = {
            type: 'general',
            category: 'article'
        };

        const lowerContent = content.toLowerCase();

        // Определение типа контента
        if (lowerContent.includes('исследование') || lowerContent.includes('study') || 
            lowerContent.includes('результаты') || lowerContent.includes('results')) {
            classification.type = 'research';
        } else if (lowerContent.includes('рекомендации') || lowerContent.includes('guidelines') ||
                   lowerContent.includes('протокол') || lowerContent.includes('protocol')) {
            classification.type = 'guideline';
        } else if (lowerContent.includes('новости') || lowerContent.includes('news') ||
                   lowerContent.includes('обновление') || lowerContent.includes('update')) {
            classification.type = 'news';
        } else if (lowerContent.includes('случай') || lowerContent.includes('case') ||
                   lowerContent.includes('клинический') || lowerContent.includes('clinical')) {
            classification.type = 'case';
        }

        // Определение категории
        if (lowerContent.includes('диабет') || lowerContent.includes('diabetes')) {
            classification.category = 'diabetes';
        } else if (lowerContent.includes('сердце') || lowerContent.includes('heart') ||
                   lowerContent.includes('кардио') || lowerContent.includes('cardio')) {
            classification.category = 'cardiology';
        } else if (lowerContent.includes('педиатр') || lowerContent.includes('pediatric')) {
            classification.category = 'pediatrics';
        }

        return classification;
    }

    /**
     * Определение языка
     */
    detectLanguage(content) {
        const cyrillicPattern = /[\u0400-\u04FF]/;
        const latinPattern = /[a-zA-Z]/;
        
        const cyrillicCount = (content.match(cyrillicPattern) || []).length;
        const latinCount = (content.match(latinPattern) || []).length;
        
        if (cyrillicCount > latinCount) {
            return 'ru';
        } else if (latinCount > cyrillicCount) {
            return 'en';
        } else {
            return 'unknown';
        }
    }

    /**
     * Генерация хеша контента
     */
    generateContentHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Генерация краткого содержания
     */
    generateSummary(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        if (sentences.length === 0) {
            return content.substring(0, 200) + '...';
        }

        // Берем первые 2-3 предложения
        const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
        return summarySentences.join('. ').trim() + '.';
    }

    /**
     * Подсчет слов
     */
    countWords(content) {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Расчет времени чтения
     */
    calculateReadingTime(content) {
        const wordsPerMinute = 200; // Средняя скорость чтения
        const wordCount = this.countWords(content);
        return Math.ceil(wordCount / wordsPerMinute);
    }

    /**
     * Расчет базового скоринга качества
     */
    calculateQualityScore(content, metadata) {
        let score = 0;

        // Длина контента (0-3 балла)
        const wordCount = this.countWords(content);
        if (wordCount > 500) score += 3;
        else if (wordCount > 300) score += 2;
        else if (wordCount > 100) score += 1;

        // Наличие авторов (0-2 балла)
        if (metadata.authors && metadata.authors.length > 0) {
            score += 2;
        }

        // Количество ключевых слов (0-2 балла)
        if (metadata.keywords && metadata.keywords.length > 5) {
            score += 2;
        } else if (metadata.keywords && metadata.keywords.length > 2) {
            score += 1;
        }

        // Качество источника (0-3 балла)
        const sourceQuality = this.assessSourceQuality(metadata.source_name);
        score += sourceQuality;

        return Math.min(score, 10); // Максимум 10 баллов
    }

    /**
     * Оценка качества источника
     */
    assessSourceQuality(sourceName) {
        const highQualitySources = [
            'nejm', 'lancet', 'jama', 'bmj', 'nature', 'science',
            'acc', 'aha', 'aap', 'aace', 'acog', 'aan'
        ];

        const mediumQualitySources = [
            'medscape', 'healio', 'cochrane', 'pubmed'
        ];

        const lowerSourceName = sourceName.toLowerCase();
        
        if (highQualitySources.some(source => lowerSourceName.includes(source))) {
            return 3;
        } else if (mediumQualitySources.some(source => lowerSourceName.includes(source))) {
            return 2;
        } else {
            return 1;
        }
    }

    /**
     * Расчет схожести текстов
     */
    calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            await this.processContent();
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса обработки:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const processor = new ContentProcessor();
    processor.run();
}

module.exports = ContentProcessor;
