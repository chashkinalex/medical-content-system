#!/usr/bin/env node

/**
 * Скрипт для тестирования сбора контента
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Добавляем корневую папку в путь для импортов
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

const ContentCollector = require('../src/collectors/content-collector');
const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

async function testCollection() {
    const logger = new Logger();
    
    try {
        logger.start('Тестирование сбора контента');
        
        // Загрузка конфигурации
        const feedsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/rss-feeds.json'), 'utf8'
        ));
        
        const specializationsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/specializations.json'), 'utf8'
        ));
        
        // Инициализация базы данных
        const database = new Database();
        await database.initialize(process.env.DATABASE_URL || 'sqlite:./data/content.db');
        
        // Инициализация сборщика
        const collector = new ContentCollector();
        await collector.initialize(feedsConfig, specializationsConfig);
        
        // Тестирование сбора из одного источника
        logger.info('🧪 Тестирование сбора из одного источника...');
        const testFeed = feedsConfig.feeds.find(feed => feed.id === 'nejm');
        
        if (testFeed) {
            const articles = await collector.collectFromSource(testFeed, {
                skipContentExtraction: true, // Пропускаем извлечение контента для теста
                maxArticles: 5
            });
            
            logger.success(`Собрано ${articles.length} статей из ${testFeed.name}`);
            
            // Вывод информации о статьях
            articles.forEach((article, index) => {
                logger.info(`Статья ${index + 1}:`, {
                    title: article.title.substring(0, 100) + '...',
                    journal: article.journal,
                    specialization: article.specialization,
                    published_date: article.published_date
                });
            });
        }
        
        // Тестирование сбора по специальности
        logger.info('🧪 Тестирование сбора по специальности...');
        const cardiologyArticles = await collector.collectBySpecialization('cardiology', {
            skipContentExtraction: true,
            maxArticles: 3
        });
        
        logger.success(`Собрано ${cardiologyArticles.length} статей по кардиологии`);
        
        // Получение статистики
        logger.info('📊 Получение статистики...');
        const stats = await collector.getCollectionStats();
        
        logger.info('Статистика сбора:', {
            totalSources: stats.length,
            sourcesWithArticles: stats.filter(s => s.articles_count > 0).length
        });
        
        // Вывод детальной статистики
        stats.forEach(stat => {
            logger.info(`Источник: ${stat.source_name}`, {
                specialization: stat.specialization,
                articles: stat.articles_count,
                lastCollection: stat.last_collection
            });
        });
        
        logger.complete('Тестирование сбора контента завершено успешно');
        
    } catch (error) {
        logger.error('Ошибка тестирования сбора контента:', error);
        process.exit(1);
    }
}

// Запуск тестирования
if (require.main === module) {
    testCollection();
}

module.exports = testCollection;
