#!/usr/bin/env node

/**
 * Скрипт для инициализации источников в базе данных
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

async function initializeSources() {
    const logger = new Logger();
    
    try {
        logger.start('Инициализация источников в базе данных');
        
        // Загрузка конфигурации RSS-фидов
        const feedsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/rss-feeds.json'), 'utf8'
        ));
        
        // Инициализация базы данных
        const database = new Database();
        await database.initialize(process.env.DATABASE_URL || 'sqlite:./data/content.db');
        
        // Очистка существующих источников
        logger.info('Очистка существующих источников...');
        await database.run('DELETE FROM sources');
        
        // Добавление источников
        logger.info('Добавление источников...');
        let addedCount = 0;
        
        for (const feed of feedsConfig.feeds) {
            try {
                await database.run(`
                    INSERT INTO sources (
                        name, url, type, level, specialization, language, enabled, last_checked
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    feed.name,
                    feed.url,
                    feed.type || 'rss',
                    feed.level,
                    feed.specialization,
                    feed.language,
                    feed.enabled ? 1 : 0,
                    null
                ]);
                
                addedCount++;
                logger.info(`✅ Добавлен источник: ${feed.name} (${feed.specialization})`);
            } catch (error) {
                logger.error(`❌ Ошибка добавления источника ${feed.name}:`, error);
            }
        }
        
        logger.success(`Добавлено ${addedCount} источников`);
        
        // Проверка добавленных источников
        const sources = await database.all('SELECT * FROM sources ORDER BY specialization, name');
        
        logger.info('📊 Статистика по специальностям:');
        const specializationStats = {};
        
        sources.forEach(source => {
            if (!specializationStats[source.specialization]) {
                specializationStats[source.specialization] = 0;
            }
            specializationStats[source.specialization]++;
        });
        
        Object.entries(specializationStats).forEach(([spec, count]) => {
            logger.info(`  ${spec}: ${count} источников`);
        });
        
        // Проверка по уровням
        logger.info('📊 Статистика по уровням:');
        const levelStats = {};
        
        sources.forEach(source => {
            if (!levelStats[source.level]) {
                levelStats[source.level] = 0;
            }
            levelStats[source.level]++;
        });
        
        Object.entries(levelStats).forEach(([level, count]) => {
            logger.info(`  Уровень ${level}: ${count} источников`);
        });
        
        logger.complete('Инициализация источников завершена успешно');
        
    } catch (error) {
        logger.error('Ошибка инициализации источников:', error);
        process.exit(1);
    }
}

// Запуск инициализации
if (require.main === module) {
    initializeSources();
}

module.exports = initializeSources;
