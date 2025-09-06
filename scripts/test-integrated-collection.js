#!/usr/bin/env node

/**
 * Скрипт для тестирования интегрированной системы сбора контента
 * из медицинских журналов и Telegram каналов
 */

const path = require('path');
const fs = require('fs');
const ContentCollector = require('../src/collectors/content-collector');
const Logger = require('../src/utils/logger');

// Создаем экземпляр логгера
const logger = new Logger();

async function testIntegratedCollection() {
    logger.info('🚀 Тестирование интегрированной системы сбора контента');
    
    try {
        // Загрузка конфигурации
        const feedsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/rss-feeds.json'), 'utf8'
        ));
        
        const specializationsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/specializations.json'), 'utf8'
        ));
        
        // Инициализация сборщика
        const collector = new ContentCollector();
        await collector.initialize(feedsConfig, specializationsConfig);
        
        // Анализ источников
        const allFeeds = feedsConfig.feeds;
        const journalFeeds = allFeeds.filter(feed => !feed.tags.includes('telegram'));
        const telegramFeeds = allFeeds.filter(feed => feed.tags.includes('telegram'));
        
        logger.info('📊 Анализ источников:', {
            totalFeeds: allFeeds.length,
            journalFeeds: journalFeeds.length,
            telegramFeeds: telegramFeeds.length
        });
        
        // Группировка по специальностям
        const feedsBySpecialization = {};
        allFeeds.forEach(feed => {
            if (!feedsBySpecialization[feed.specialization]) {
                feedsBySpecialization[feed.specialization] = {
                    journals: [],
                    telegram: []
                };
            }
            
            if (feed.tags.includes('telegram')) {
                feedsBySpecialization[feed.specialization].telegram.push(feed);
            } else {
                feedsBySpecialization[feed.specialization].journals.push(feed);
            }
        });
        
        // Вывод статистики по специальностям
        logger.info('\n📋 Статистика по специальностям:');
        Object.entries(feedsBySpecialization).forEach(([spec, feeds]) => {
            logger.info(`  ${spec}:`, {
                journals: feeds.journals.length,
                telegram: feeds.telegram.length,
                total: feeds.journals.length + feeds.telegram.length
            });
        });
        
        // Тестирование сбора из журналов (только несколько для теста)
        logger.info('\n📚 Тестирование сбора из медицинских журналов...');
        const testJournalFeeds = journalFeeds.slice(0, 3); // Берем только первые 3 для теста
        
        for (const feed of testJournalFeeds) {
            try {
                logger.info(`📡 Тестирование журнала: ${feed.name}`);
                const articles = await collector.collectFromSource(feed, {
                    skipContentExtraction: true, // Пропускаем извлечение полного контента для скорости
                    maxArticles: 2 // Ограничиваем количество статей для теста
                });
                
                logger.success(`✅ ${feed.name}: собрано ${articles.length} статей`);
                
                if (articles.length > 0) {
                    const article = articles[0];
                    logger.info(`  Пример статьи: "${article.title}"`);
                    logger.info(`  Специальность: ${article.specialization}`);
                    logger.info(`  Журнал: ${article.journal}`);
                }
            } catch (error) {
                logger.error(`❌ Ошибка сбора из ${feed.name}:`, error.message);
            }
        }
        
        // Тестирование Telegram RSS-фидов (если система запущена)
        logger.info('\n📱 Тестирование Telegram RSS-фидов...');
        const testTelegramFeeds = telegramFeeds.slice(0, 2); // Берем только первые 2 для теста
        
        for (const feed of testTelegramFeeds) {
            try {
                logger.info(`📡 Тестирование Telegram: ${feed.name}`);
                
                // Проверяем доступность RSS-фида
                const axios = require('axios');
                const response = await axios.get(feed.url, { timeout: 5000 });
                
                if (response.status === 200) {
                    logger.success(`✅ ${feed.name}: RSS-фид доступен`);
                    
                    // Пробуем собрать контент
                    const articles = await collector.collectFromSource(feed, {
                        skipContentExtraction: true,
                        maxArticles: 1
                    });
                    
                    logger.success(`✅ ${feed.name}: собрано ${articles.length} постов`);
                    
                    if (articles.length > 0) {
                        const article = articles[0];
                        logger.info(`  Пример поста: "${article.title}"`);
                        logger.info(`  Специальность: ${article.specialization}`);
                    }
                } else {
                    logger.warn(`⚠️ ${feed.name}: RSS-фид недоступен (статус: ${response.status})`);
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    logger.warn(`⚠️ ${feed.name}: Telegram-to-RSS система не запущена`);
                    logger.info('   Запустите систему: npm run start:telegram');
                } else {
                    logger.error(`❌ Ошибка тестирования ${feed.name}:`, error.message);
                }
            }
        }
        
        // Тестирование сбора по специальности
        logger.info('\n🎯 Тестирование сбора по специальности (кардиология)...');
        try {
            const cardiologyArticles = await collector.collectBySpecialization('cardiology', {
                skipContentExtraction: true,
                maxArticles: 3
            });
            
            logger.success(`✅ Кардиология: собрано ${cardiologyArticles.length} статей/постов`);
            
            // Группировка по источникам
            const sources = {};
            cardiologyArticles.forEach(article => {
                if (!sources[article.source_id]) {
                    sources[article.source_id] = 0;
                }
                sources[article.source_id]++;
            });
            
            logger.info('  Источники:', sources);
            
        } catch (error) {
            logger.error('❌ Ошибка сбора по специальности:', error.message);
        }
        
        // Получение статистики
        logger.info('\n📊 Получение статистики сбора...');
        try {
            const stats = await collector.getCollectionStats();
            logger.info('Статистика по источникам:');
            stats.forEach(stat => {
                logger.info(`  ${stat.source_name} (${stat.specialization}): ${stat.articles_count} статей`);
            });
        } catch (error) {
            logger.error('❌ Ошибка получения статистики:', error.message);
        }
        
        logger.success('\n🎉 Тестирование интегрированной системы завершено!');
        
        // Рекомендации
        logger.info('\n💡 Рекомендации:');
        logger.info('1. Для полного тестирования запустите Telegram-to-RSS: npm run start:telegram');
        logger.info('2. Настройте Telegram API credentials в .env.telegram');
        logger.info('3. Запустите полный сбор: npm run collect');
        logger.info('4. Мониторьте логи: tail -f logs/collection.log');
        
    } catch (error) {
        logger.error('❌ Критическая ошибка тестирования:', error);
        process.exit(1);
    }
}

// Запуск тестирования
if (require.main === module) {
    testIntegratedCollection();
}

module.exports = testIntegratedCollection;
