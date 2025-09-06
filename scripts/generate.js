#!/usr/bin/env node

/**
 * Генератор постов для Telegram
 * Создает адаптированный контент для медицинских каналов
 */

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

class PostGenerator {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        
        // Настройки генерации
        this.settings = {
            maxPostLength: 300,      // Максимальная длина поста
            minPostLength: 100,      // Минимальная длина поста
            maxKeyPoints: 5,         // Максимальное количество ключевых моментов
            maxPostsPerSpecialization: 5 // Максимум постов на специальность в день
        };

        // Шаблоны постов по типам
        this.templates = {
            research: {
                structure: ['title', 'summary', 'keyFindings', 'practicalApplication', 'source'],
                length: '200-300 слов',
                format: 'Заголовок → Суть → Выводы → Применение → Источник'
            },
            guideline: {
                structure: ['problem', 'solution', 'algorithm', 'application'],
                length: '150-250 слов',
                format: 'Проблема → Решение → Алгоритм → Применение'
            },
            news: {
                structure: ['news', 'context', 'significance', 'source'],
                length: '100-200 слов',
                format: 'Новость → Контекст → Значение → Источник'
            },
            case: {
                structure: ['case', 'diagnosis', 'treatment', 'outcome', 'lessons'],
                length: '150-250 слов',
                format: 'Случай → Диагноз → Лечение → Исход → Уроки'
            }
        };
    }

    /**
     * Основной метод генерации постов
     */
    async generatePosts() {
        try {
            this.logger.info('Начинаем генерацию постов...');

            // Получаем статьи для генерации постов
            const articles = await this.database.getArticlesForPostGeneration();
            
            if (articles.length === 0) {
                this.logger.info('Нет статей для генерации постов');
                return;
            }

            this.logger.info(`Найдено ${articles.length} статей для генерации постов`);

            let generatedCount = 0;
            let skippedCount = 0;

            // Группируем по специальностям
            const articlesBySpecialization = this.groupArticlesBySpecialization(articles);

            // Генерируем посты для каждой специальности
            for (const [specialization, specializationArticles] of Object.entries(articlesBySpecialization)) {
                try {
                    const posts = await this.generatePostsForSpecialization(specialization, specializationArticles);
                    
                    for (const post of posts) {
                        await this.database.saveGeneratedPost(post);
                        generatedCount++;
                    }
                } catch (error) {
                    this.logger.error(`Ошибка при генерации постов для ${specialization}:`, error);
                    skippedCount += specializationArticles.length;
                }
            }

            this.logger.info(`Генерация завершена: ${generatedCount} постов создано, ${skippedCount} пропущено`);

        } catch (error) {
            this.logger.error('Ошибка при генерации постов:', error);
        }
    }

    /**
     * Группировка статей по специальностям
     */
    groupArticlesBySpecialization(articles) {
        const grouped = {};
        
        articles.forEach(article => {
            const specialization = this.determineSpecialization(article);
            if (!grouped[specialization]) {
                grouped[specialization] = [];
            }
            grouped[specialization].push(article);
        });

        return grouped;
    }

    /**
     * Определение специальности статьи
     */
    determineSpecialization(article) {
        const content = (article.content + ' ' + article.title).toLowerCase();
        
        // Кардиология
        if (content.includes('сердце') || content.includes('heart') || 
            content.includes('кардио') || content.includes('cardio') ||
            content.includes('артерия') || content.includes('artery')) {
            return 'cardiology';
        }
        
        // Эндокринология
        if (content.includes('диабет') || content.includes('diabetes') ||
            content.includes('щитовидная') || content.includes('thyroid') ||
            content.includes('гормон') || content.includes('hormone') ||
            content.includes('инсулин') || content.includes('insulin')) {
            return 'endocrinology';
        }
        
        // Педиатрия
        if (content.includes('ребенок') || content.includes('child') ||
            content.includes('педиатр') || content.includes('pediatric') ||
            content.includes('детский') || content.includes('infant')) {
            return 'pediatrics';
        }
        
        // Гастроэнтерология
        if (content.includes('желудок') || content.includes('stomach') ||
            content.includes('кишечник') || content.includes('intestine') ||
            content.includes('печень') || content.includes('liver') ||
            content.includes('гастро') || content.includes('gastro')) {
            return 'gastroenterology';
        }
        
        // Гинекология
        if (content.includes('женщина') || content.includes('woman') ||
            content.includes('беременность') || content.includes('pregnancy') ||
            content.includes('гинеколог') || content.includes('gynecology') ||
            content.includes('матка') || content.includes('uterus')) {
            return 'gynecology';
        }
        
        // Неврология
        if (content.includes('мозг') || content.includes('brain') ||
            content.includes('нерв') || content.includes('nerve') ||
            content.includes('невролог') || content.includes('neurology') ||
            content.includes('эпилепсия') || content.includes('epilepsy')) {
            return 'neurology';
        }
        
        // Терапия (по умолчанию)
        return 'therapy';
    }

    /**
     * Генерация постов для специальности
     */
    async generatePostsForSpecialization(specialization, articles) {
        const posts = [];
        
        // Ограничиваем количество постов на специальность
        const limitedArticles = articles.slice(0, this.settings.maxPostsPerSpecialization);
        
        for (const article of limitedArticles) {
            try {
                const post = await this.generatePost(article, specialization);
                if (post) {
                    posts.push(post);
                }
            } catch (error) {
                this.logger.error(`Ошибка при генерации поста для статьи ${article.id}:`, error);
            }
        }
        
        return posts;
    }

    /**
     * Генерация одного поста
     */
    async generatePost(article, specialization) {
        try {
            // Определяем тип поста
            const postType = this.determinePostType(article);
            
            // Генерируем контент по шаблону
            const content = this.generatePostContent(article, postType, specialization);
            
            // Проверяем качество сгенерированного поста
            if (!this.validatePost(content)) {
                this.logger.info(`Пост для статьи ${article.id} не прошел валидацию`);
                return null;
            }

            const post = {
                article_id: article.id,
                specialization: specialization,
                post_type: postType,
                title: this.generatePostTitle(article, postType),
                content: content,
                summary: this.generatePostSummary(content),
                key_points: this.extractKeyPoints(content),
                practical_application: this.extractPracticalApplication(content),
                source_name: article.source_name,
                source_url: article.url,
                score: article.quality_score,
                generated_date: new Date(),
                status: 'pending_moderation',
                
                // Метаданные
                word_count: this.countWords(content),
                reading_time: this.calculateReadingTime(content),
                hashtags: this.generateHashtags(specialization, postType)
            };

            return post;

        } catch (error) {
            this.logger.error(`Ошибка при генерации поста для статьи ${article.id}:`, error);
            return null;
        }
    }

    /**
     * Определение типа поста
     */
    determinePostType(article) {
        const contentType = article.content_type;
        const content = article.content.toLowerCase();
        
        if (contentType === 'research' || content.includes('исследование') || content.includes('study')) {
            return 'research';
        } else if (contentType === 'guideline' || content.includes('рекомендации') || content.includes('guideline')) {
            return 'guideline';
        } else if (contentType === 'news' || content.includes('новости') || content.includes('news')) {
            return 'news';
        } else if (contentType === 'case' || content.includes('случай') || content.includes('case')) {
            return 'case';
        } else {
            return 'research'; // По умолчанию
        }
    }

    /**
     * Генерация контента поста
     */
    generatePostContent(article, postType, specialization) {
        const template = this.templates[postType];
        const emoji = this.getPostEmoji(postType);
        const specializationEmoji = this.getSpecializationEmoji(specialization);
        
        let content = '';
        
        switch (postType) {
            case 'research':
                content = this.generateResearchPost(article, emoji, specializationEmoji);
                break;
            case 'guideline':
                content = this.generateGuidelinePost(article, emoji, specializationEmoji);
                break;
            case 'news':
                content = this.generateNewsPost(article, emoji, specializationEmoji);
                break;
            case 'case':
                content = this.generateCasePost(article, emoji, specializationEmoji);
                break;
            default:
                content = this.generateResearchPost(article, emoji, specializationEmoji);
        }
        
        return content;
    }

    /**
     * Генерация исследовательского поста
     */
    generateResearchPost(article, emoji, specializationEmoji) {
        const keyFindings = this.extractKeyFindings(article.content);
        const practicalApplication = this.extractPracticalApplication(article.content);
        
        return `${emoji} **${this.adaptTitle(article.title)}**\n\n` +
               `📋 **Суть:**\n${this.generateSummary(article.content)}\n\n` +
               `🔍 **Ключевые выводы:**\n${this.formatKeyPoints(keyFindings)}\n\n` +
               `💡 **Практическое применение:**\n${practicalApplication}\n\n` +
               `📚 **Источник:** ${article.source_name}\n` +
               `🔗 **Ссылка:** [Читать полностью](${article.url})\n\n` +
               `${specializationEmoji} #${article.specialization || 'медицина'} #исследование #клиническаяпрактика`;
    }

    /**
     * Генерация поста с рекомендациями
     */
    generateGuidelinePost(article, emoji, specializationEmoji) {
        const problem = this.extractProblem(article.content);
        const solution = this.extractSolution(article.content);
        const algorithm = this.extractAlgorithm(article.content);
        
        return `${emoji} **${this.adaptTitle(article.title)}**\n\n` +
               `🎯 **Проблема:**\n${problem}\n\n` +
               `✅ **Решение:**\n${solution}\n\n` +
               `📋 **Алгоритм действий:**\n${this.formatKeyPoints(algorithm)}\n\n` +
               `📚 **Источник:** ${article.source_name}\n` +
               `🔗 **Ссылка:** [Читать полностью](${article.url})\n\n` +
               `${specializationEmoji} #${article.specialization || 'медицина'} #рекомендации #клиническаяпрактика`;
    }

    /**
     * Генерация новостного поста
     */
    generateNewsPost(article, emoji, specializationEmoji) {
        const news = this.extractNews(article.content);
        const context = this.extractContext(article.content);
        const significance = this.extractSignificance(article.content);
        
        return `${emoji} **${this.adaptTitle(article.title)}**\n\n` +
               `📰 **Новость:**\n${news}\n\n` +
               `🔍 **Контекст:**\n${context}\n\n` +
               `💡 **Значение:**\n${significance}\n\n` +
               `📚 **Источник:** ${article.source_name}\n` +
               `🔗 **Ссылка:** [Читать полностью](${article.url})\n\n` +
               `${specializationEmoji} #${article.specialization || 'медицина'} #новости #медицина`;
    }

    /**
     * Генерация поста с клиническим случаем
     */
    generateCasePost(article, emoji, specializationEmoji) {
        const caseDescription = this.extractCaseDescription(article.content);
        const diagnosis = this.extractDiagnosis(article.content);
        const treatment = this.extractTreatment(article.content);
        const outcome = this.extractOutcome(article.content);
        
        return `${emoji} **${this.adaptTitle(article.title)}**\n\n` +
               `📝 **Случай:**\n${caseDescription}\n\n` +
               `🔍 **Диагноз:**\n${diagnosis}\n\n` +
               `💊 **Лечение:**\n${treatment}\n\n` +
               `✅ **Исход:**\n${outcome}\n\n` +
               `📚 **Источник:** ${article.source_name}\n` +
               `🔗 **Ссылка:** [Читать полностью](${article.url})\n\n` +
               `${specializationEmoji} #${article.specialization || 'медицина'} #клиническийслучай #практика`;
    }

    /**
     * Адаптация заголовка для Telegram
     */
    adaptTitle(title) {
        // Упрощаем заголовок
        let adapted = title
            .replace(/^\d+\.\s*/, '') // Убираем нумерацию
            .replace(/\s*:\s*/, ': ') // Нормализуем двоеточие
            .replace(/\s+/g, ' ')     // Нормализуем пробелы
            .trim();
        
        // Ограничиваем длину
        if (adapted.length > 80) {
            adapted = adapted.substring(0, 77) + '...';
        }
        
        return adapted;
    }

    /**
     * Генерация краткого содержания
     */
    generateSummary(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        if (sentences.length === 0) {
            return content.substring(0, 150) + '...';
        }
        
        // Берем первые 1-2 предложения
        const summarySentences = sentences.slice(0, Math.min(2, sentences.length));
        return summarySentences.join('. ').trim() + '.';
    }

    /**
     * Извлечение ключевых выводов
     */
    extractKeyFindings(content) {
        const findings = [];
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Ищем предложения с ключевыми словами
        const keyWords = ['результат', 'вывод', 'обнаружено', 'показано', 'установлено', 
                         'result', 'finding', 'showed', 'demonstrated', 'revealed'];
        
        sentences.forEach(sentence => {
            const lowerSentence = sentence.toLowerCase();
            if (keyWords.some(word => lowerSentence.includes(word))) {
                findings.push(sentence.trim());
            }
        });
        
        return findings.slice(0, 3); // Максимум 3 вывода
    }

    /**
     * Извлечение практического применения
     */
    extractPracticalApplication(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Ищем предложения с практическими указаниями
        const practicalWords = ['рекомендуется', 'следует', 'необходимо', 'важно',
                               'recommended', 'should', 'necessary', 'important'];
        
        for (const sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            if (practicalWords.some(word => lowerSentence.includes(word))) {
                return sentence.trim() + '.';
            }
        }
        
        return 'Практические рекомендации будут дополнены.';
    }

    /**
     * Форматирование ключевых моментов
     */
    formatKeyPoints(points) {
        if (!points || points.length === 0) {
            return '• Ключевые моменты будут дополнены';
        }
        
        return points.map(point => `• ${point}`).join('\n');
    }

    /**
     * Получение эмодзи для типа поста
     */
    getPostEmoji(type) {
        const emojis = {
            'research': '🔬',
            'guideline': '📋',
            'news': '📰',
            'case': '📝',
            'general': '🏥'
        };
        return emojis[type] || '🏥';
    }

    /**
     * Получение эмодзи для специальности
     */
    getSpecializationEmoji(specialization) {
        const emojis = {
            'cardiology': '❤️',
            'endocrinology': '🩺',
            'pediatrics': '👶',
            'gastroenterology': '🫀',
            'gynecology': '👩',
            'neurology': '🧠',
            'therapy': '🩹'
        };
        return emojis[specialization] || '🏥';
    }

    /**
     * Генерация хештегов
     */
    generateHashtags(specialization, postType) {
        const baseHashtags = ['#медицина', '#клиническаяпрактика'];
        const specializationHashtags = [`#${specialization}`];
        const typeHashtags = {
            'research': ['#исследование'],
            'guideline': ['#рекомендации'],
            'news': ['#новости'],
            'case': ['#клиническийслучай']
        };
        
        return [...baseHashtags, ...specializationHashtags, ...(typeHashtags[postType] || [])];
    }

    /**
     * Валидация поста
     */
    validatePost(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }
        
        const length = content.length;
        if (length < this.settings.minPostLength || length > this.settings.maxPostLength * 2) {
            return false;
        }
        
        return true;
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
        const wordsPerMinute = 200;
        const wordCount = this.countWords(content);
        return Math.ceil(wordCount / wordsPerMinute);
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            await this.generatePosts();
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса генерации:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const generator = new PostGenerator();
    generator.run();
}

module.exports = PostGenerator;
