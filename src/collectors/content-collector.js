const axios = require('axios');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

/**
 * Модуль сбора контента из различных источников
 */
class ContentCollector {
    constructor() {
        this.parser = new Parser({
            timeout: 30000,
            headers: {
                'User-Agent': 'MedicalContentSystem/1.0 (Medical Content Aggregator)'
            }
        });
        this.logger = null;
        this.database = null;
        this.feeds = [];
        this.specializations = {};
    }

    /**
     * Инициализация сборщика контента
     */
    async initialize(feedsConfig, specializationsConfig = null) {
        try {
            // Инициализация логгера
            const Logger = require('../utils/logger');
            this.logger = new Logger();

            // Инициализация базы данных
            const Database = require('../utils/database');
            this.database = new Database();

            this.feeds = feedsConfig.feeds || [];
            this.specializations = specializationsConfig?.specializations || {};

            this.logger.success('ContentCollector инициализирован', {
                feedsCount: this.feeds.length,
                specializationsCount: Object.keys(this.specializations).length
            });

            return true;
        } catch (error) {
            if (this.logger) {
                this.logger.error('Ошибка инициализации ContentCollector:', error);
            }
            throw error;
        }
    }

    /**
     * Сбор контента из всех источников
     */
    async collectAll(options = {}) {
        const results = [];
        const enabledFeeds = this.feeds.filter(feed => feed.enabled);

        this.logger.start('Начало сбора контента', {
            totalFeeds: enabledFeeds.length,
            options
        });

        for (const feed of enabledFeeds) {
            try {
                this.logger.info(`📡 Сбор из источника: ${feed.name}`);
                const articles = await this.collectFromSource(feed, options);
                results.push(...articles);
                
                this.logger.success(`Собрано ${articles.length} статей из ${feed.name}`);
            } catch (error) {
                this.logger.error(`Ошибка сбора из ${feed.name}:`, error);
            }
        }

        this.logger.complete('Сбор контента завершен', {
            totalArticles: results.length,
            sourcesProcessed: enabledFeeds.length
        });

        return results;
    }

    /**
     * Сбор контента из конкретного источника
     */
    async collectFromSource(source, options = {}) {
        const articles = [];

        try {
            if (source.type === 'rss' || !source.type) {
                const rssArticles = await this.collectFromRSS(source, options);
                articles.push(...rssArticles);
            } else if (source.type === 'pubmed') {
                const pubmedArticles = await this.collectFromPubMed(source, options);
                articles.push(...pubmedArticles);
            }

            // Сохранение в базу данных
            if (articles.length > 0) {
                await this.saveArticles(articles, source);
            }

            return articles;
        } catch (error) {
            this.logger.error(`Ошибка сбора из источника ${source.name}:`, error);
            throw error;
        }
    }

    /**
     * Сбор контента из RSS-фида
     */
    async collectFromRSS(feed, options = {}) {
        const articles = [];

        try {
            this.logger.info(`📡 Парсинг RSS: ${feed.url}`);
            
            const feedData = await this.parser.parseURL(feed.url);
            
            if (!feedData.items || feedData.items.length === 0) {
                this.logger.warn(`RSS-фид пуст: ${feed.name}`);
                return articles;
            }

            for (const item of feedData.items) {
                try {
                    const article = await this.processRSSItem(item, feed, options);
                    if (article) {
                        articles.push(article);
                    }
                } catch (error) {
                    this.logger.error(`Ошибка обработки RSS-элемента:`, error);
                }
            }

            this.logger.rss(feed.name, articles.length);
            return articles;
        } catch (error) {
            this.logger.error(`Ошибка парсинга RSS ${feed.name}:`, error);
            throw error;
        }
    }

    /**
     * Обработка элемента RSS-фида
     */
    async processRSSItem(item, feed, options = {}) {
        try {
            // Проверка на дубликаты
            const existingArticle = await this.database.get(
                'SELECT id FROM articles WHERE url = ?',
                [item.link]
            );

            if (existingArticle) {
                this.logger.debug(`Статья уже существует: ${item.title}`);
                return null;
            }

            // Извлечение контента
            const content = await this.extractContent(item.link, options);
            
            // Определение специальности
            const specialization = this.determineSpecialization(item, feed);

            const article = {
                source_id: feed.id,
                title: this.cleanTitle(item.title),
                url: item.link,
                summary: this.extractSummary(item.contentSnippet || item.content || ''),
                content: content,
                authors: this.extractAuthors(item.creator || item.author || ''),
                journal: this.extractJournal(item, feed),
                published_date: this.parseDate(item.pubDate || item.isoDate),
                collected_date: new Date().toISOString(),
                specialization: specialization,
                tags: this.extractTags(item, feed),
                metadata: JSON.stringify({
                    guid: item.guid,
                    categories: item.categories || [],
                    enclosure: item.enclosure || null
                }),
                status: 'collected'
            };

            return article;
        } catch (error) {
            this.logger.error(`Ошибка обработки RSS-элемента:`, error);
            return null;
        }
    }

    /**
     * Извлечение контента со страницы
     */
    async extractContent(url, options = {}) {
        try {
            if (options.skipContentExtraction) {
                return '';
            }

            const response = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'MedicalContentSystem/1.0 (Medical Content Aggregator)'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Попытка найти основной контент
            let content = '';
            
            // Различные селекторы для медицинских журналов
            const selectors = [
                '.article-content',
                '.article-body',
                '.content',
                '.main-content',
                '.article-text',
                '.abstract',
                '[data-testid="article-content"]',
                '.c-article-body',
                '.article-section'
            ];

            for (const selector of selectors) {
                const element = $(selector);
                if (element.length > 0) {
                    content = element.text().trim();
                    break;
                }
            }

            // Если не найден основной контент, берем весь текст
            if (!content) {
                content = $('body').text().trim();
            }

            // Очистка контента
            content = this.cleanContent(content);
            
            return content.substring(0, 10000); // Ограничение длины
        } catch (error) {
            this.logger.error(`Ошибка извлечения контента из ${url}:`, error);
            return '';
        }
    }

    /**
     * Определение специальности статьи
     */
    determineSpecialization(item, feed) {
        // Если у фида указана специальность
        if (feed.specialization && feed.specialization !== 'general') {
            return feed.specialization;
        }

        // Анализ ключевых слов
        const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
        
        for (const [spec, config] of Object.entries(this.specializations)) {
            for (const keyword of config.keywords) {
                if (text.includes(keyword.toLowerCase())) {
                    return spec;
                }
            }
        }

        return 'general';
    }

    /**
     * Извлечение авторов
     */
    extractAuthors(authorString) {
        if (!authorString) return '';
        
        // Очистка и форматирование авторов
        return authorString
            .split(/[,;]/)
            .map(author => author.trim())
            .filter(author => author.length > 0)
            .join(', ');
    }

    /**
     * Извлечение журнала
     */
    extractJournal(item, feed) {
        // Попытка извлечь из заголовка фида
        if (feed.name && feed.name.includes('Journal')) {
            return feed.name;
        }

        // Попытка извлечь из URL
        const url = item.link || '';
        const domain = new URL(url).hostname;
        
        const journalMappings = {
            'nejm.org': 'New England Journal of Medicine',
            'thelancet.com': 'The Lancet',
            'jamanetwork.com': 'JAMA',
            'bmj.com': 'BMJ',
            'ahajournals.org': 'Circulation',
            'academic.oup.com': 'European Heart Journal'
        };

        return journalMappings[domain] || feed.name || 'Unknown Journal';
    }

    /**
     * Извлечение тегов
     */
    extractTags(item, feed) {
        const tags = [];

        // Теги из фида
        if (feed.tags) {
            tags.push(...feed.tags);
        }

        // Теги из категорий
        if (item.categories) {
            tags.push(...item.categories);
        }

        // Теги из специальности
        const specialization = this.determineSpecialization(item, feed);
        if (specialization !== 'general') {
            tags.push(specialization);
        }

        return [...new Set(tags)].join(', ');
    }

    /**
     * Очистка заголовка
     */
    cleanTitle(title) {
        if (!title) return '';
        
        return title
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-.,:;!?()]/g, '')
            .trim();
    }

    /**
     * Очистка контента
     */
    cleanContent(content) {
        if (!content) return '';
        
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
    }

    /**
     * Извлечение краткого содержания
     */
    extractSummary(content) {
        if (!content) return '';
        
        // Ограничение длины до 500 символов
        const summary = content.substring(0, 500);
        
        // Поиск последнего полного предложения
        const lastSentence = summary.lastIndexOf('.');
        if (lastSentence > 200) {
            return summary.substring(0, lastSentence + 1);
        }
        
        return summary + '...';
    }

    /**
     * Парсинг даты
     */
    parseDate(dateString) {
        if (!dateString) return new Date().toISOString();
        
        try {
            const date = new Date(dateString);
            return date.toISOString();
        } catch (error) {
            this.logger.warn(`Ошибка парсинга даты: ${dateString}`);
            return new Date().toISOString();
        }
    }

    /**
     * Сохранение статей в базу данных
     */
    async saveArticles(articles, source) {
        try {
            let savedCount = 0;

            for (const article of articles) {
                try {
                    await this.database.run(`
                        INSERT INTO articles (
                            source_id, title, url, summary, content, authors, journal,
                            published_date, collected_date, specialization, tags, metadata, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        article.source_id,
                        article.title,
                        article.url,
                        article.summary,
                        article.content,
                        article.authors,
                        article.journal,
                        article.published_date,
                        article.collected_date,
                        article.specialization,
                        article.tags,
                        article.metadata,
                        article.status
                    ]);
                    
                    savedCount++;
                } catch (error) {
                    if (error.message.includes('UNIQUE constraint failed')) {
                        this.logger.debug(`Статья уже существует: ${article.title}`);
                    } else {
                        this.logger.error(`Ошибка сохранения статьи:`, error);
                    }
                }
            }

            this.logger.success(`Сохранено ${savedCount} статей из ${source.name}`);
            return savedCount;
        } catch (error) {
            this.logger.error('Ошибка сохранения статей:', error);
            throw error;
        }
    }

    /**
     * Сбор контента по специальности
     */
    async collectBySpecialization(specialization, options = {}) {
        const specializationFeeds = this.feeds.filter(feed => 
            feed.specialization === specialization && feed.enabled
        );

        this.logger.info(`📚 Сбор контента для специальности: ${specialization}`, {
            feedsCount: specializationFeeds.length
        });

        const results = [];
        for (const feed of specializationFeeds) {
            try {
                const articles = await this.collectFromSource(feed, options);
                results.push(...articles);
            } catch (error) {
                this.logger.error(`Ошибка сбора для ${specialization}:`, error);
            }
        }

        return results;
    }

    /**
     * Сбор контента из PubMed (заглушка для будущей реализации)
     */
    async collectFromPubMed(source, options = {}) {
        // TODO: Реализовать сбор из PubMed API
        this.logger.info('PubMed сбор пока не реализован');
        return [];
    }

    /**
     * Получение статистики сбора
     */
    async getCollectionStats() {
        try {
            const stats = await this.database.all(`
                SELECT 
                    s.name as source_name,
                    s.specialization,
                    COUNT(a.id) as articles_count,
                    MAX(a.collected_date) as last_collection
                FROM sources s
                LEFT JOIN articles a ON s.id = a.source_id
                GROUP BY s.id, s.name, s.specialization
                ORDER BY articles_count DESC
            `);

            return stats;
        } catch (error) {
            this.logger.error('Ошибка получения статистики сбора:', error);
            return [];
        }
    }
}

module.exports = ContentCollector;
