#!/usr/bin/env node

/**
 * Скрипт для отображения всех источников по специальностям
 */

const fs = require('fs');
const path = require('path');

function listAllSources() {
    console.log('📚 Полный список источников медицинского контента\n');
    
    try {
        // Загрузка конфигурации
        const feedsConfig = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../config/rss-feeds.json'), 'utf8'
        ));
        
        const allFeeds = feedsConfig.feeds;
        
        // Группировка по специальностям
        const feedsBySpecialization = {};
        allFeeds.forEach(feed => {
            if (!feedsBySpecialization[feed.specialization]) {
                feedsBySpecialization[feed.specialization] = [];
            }
            feedsBySpecialization[feed.specialization].push(feed);
        });
        
        // Сортировка специальностей
        const specializations = Object.keys(feedsBySpecialization).sort();
        
        // Общая статистика
        console.log('📊 Общая статистика:');
        console.log(`Всего источников: ${allFeeds.length}`);
        console.log(`Специальностей: ${specializations.length}`);
        console.log('');
        
        // Детальная статистика по специальностям
        specializations.forEach(spec => {
            const feeds = feedsBySpecialization[spec];
            const journalFeeds = feeds.filter(f => !f.tags.includes('telegram'));
            const telegramFeeds = feeds.filter(f => f.tags.includes('telegram'));
            
            console.log(`🏥 ${spec.toUpperCase()} (${feeds.length} источников)`);
            console.log(`   📚 Журналы/Общества: ${journalFeeds.length}`);
            console.log(`   📱 Telegram каналы: ${telegramFeeds.length}`);
            console.log('');
        });
        
        // Детальный список по специальностям
        specializations.forEach(spec => {
            const feeds = feedsBySpecialization[spec];
            const journalFeeds = feeds.filter(f => !f.tags.includes('telegram'));
            const telegramFeeds = feeds.filter(f => f.tags.includes('telegram'));
            
            console.log(`\n🏥 ${spec.toUpperCase()} (${feeds.length} источников)`);
            console.log('='.repeat(50));
            
            if (journalFeeds.length > 0) {
                console.log('\n📚 Журналы и профессиональные общества:');
                journalFeeds.forEach(feed => {
                    const level = feed.level || 'B';
                    const tags = feed.tags ? feed.tags.join(', ') : '';
                    console.log(`   ${level} ${feed.name}`);
                    console.log(`      URL: ${feed.url}`);
                    console.log(`      Теги: ${tags}`);
                    console.log('');
                });
            }
            
            if (telegramFeeds.length > 0) {
                console.log('\n📱 Telegram каналы:');
                telegramFeeds.forEach(feed => {
                    console.log(`   ${feed.name}`);
                    console.log(`      URL: ${feed.url}`);
                    console.log('');
                });
            }
        });
        
        // Статистика по уровням
        console.log('\n📊 Статистика по уровням:');
        const levelStats = {};
        allFeeds.forEach(feed => {
            const level = feed.level || 'B';
            if (!levelStats[level]) {
                levelStats[level] = 0;
            }
            levelStats[level]++;
        });
        
        Object.keys(levelStats).sort().forEach(level => {
            console.log(`   Уровень ${level}: ${levelStats[level]} источников`);
        });
        
        // Статистика по тегам
        console.log('\n🏷️ Популярные теги:');
        const tagStats = {};
        allFeeds.forEach(feed => {
            if (feed.tags) {
                feed.tags.forEach(tag => {
                    if (!tagStats[tag]) {
                        tagStats[tag] = 0;
                    }
                    tagStats[tag]++;
                });
            }
        });
        
        Object.entries(tagStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([tag, count]) => {
                console.log(`   ${tag}: ${count} источников`);
            });
        
    } catch (error) {
        console.error('❌ Ошибка при чтении конфигурации:', error.message);
    }
}

// Запуск
if (require.main === module) {
    listAllSources();
}

module.exports = listAllSources;
