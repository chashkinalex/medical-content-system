#!/usr/bin/env node

/**
 * Скрипт для извлечения Telegram каналов из Excel файлов
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Путь к папке с файлами
const TARGETING_PATH = '/Users/alexchashkin/Downloads/Таргетинги';

// Файлы по нашим специальностям
const SPECIALIZATION_FILES = {
    'cardiology': 'Кардиологи — группы и каналы.xlsx',
    'pediatrics': 'Педиатры — группы и каналы.xlsx',
    'gastroenterology': 'Гастроэнтерологи/Гастроэнтерология - группы и каналы.xlsx',
    'endocrinology': 'Эндокринологи.xlsx',
    'gynecology': 'Гинекологи — группы и каналы.xlsx',
    'neurology': 'Каналы по неврологии.xlsx',
    'therapy': 'Терапевты - группы и каналы.xlsx'
};

/**
 * Извлечение каналов из Excel файла
 */
function extractChannelsFromFile(filePath, specialization) {
    try {
        console.log(`📖 Чтение файла: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Файл не найден: ${filePath}`);
            return [];
        }

        const workbook = XLSX.readFile(filePath);
        const channels = [];

        // Перебираем все листы в файле
        workbook.SheetNames.forEach(sheetName => {
            console.log(`📋 Обработка листа: ${sheetName}`);
            
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Ищем строки с каналами
            jsonData.forEach((row, rowIndex) => {
                if (Array.isArray(row)) {
                    row.forEach((cell, colIndex) => {
                        if (typeof cell === 'string') {
                            // Ищем Telegram каналы (начинающиеся с @ или t.me)
                            const channelMatch = cell.match(/(?:@|t\.me\/)([a-zA-Z0-9_]+)/g);
                            if (channelMatch) {
                                channelMatch.forEach(match => {
                                    let channelName = match.replace(/^@/, '').replace(/^t\.me\//, '');
                                    if (channelName && !channels.includes(channelName)) {
                                        channels.push(channelName);
                                        console.log(`  ✅ Найден канал: @${channelName}`);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });

        return channels;
    } catch (error) {
        console.error(`❌ Ошибка при чтении файла ${filePath}:`, error.message);
        return [];
    }
}

/**
 * Основная функция
 */
async function main() {
    console.log('🚀 Начало извлечения Telegram каналов из Excel файлов\n');

    const allChannels = {};

    // Обрабатываем каждый файл
    for (const [specialization, fileName] of Object.entries(SPECIALIZATION_FILES)) {
        console.log(`\n📁 Обработка специальности: ${specialization}`);
        console.log(`📄 Файл: ${fileName}`);
        
        const filePath = path.join(TARGETING_PATH, fileName);
        const channels = extractChannelsFromFile(filePath, specialization);
        
        allChannels[specialization] = channels;
        
        console.log(`📊 Найдено каналов: ${channels.length}`);
        if (channels.length > 0) {
            console.log(`📋 Каналы: ${channels.map(c => `@${c}`).join(', ')}`);
        }
    }

    // Сохраняем результаты
    const outputPath = path.join(__dirname, '../config/telegram-channels.json');
    fs.writeFileSync(outputPath, JSON.stringify(allChannels, null, 2));
    
    console.log(`\n💾 Результаты сохранены в: ${outputPath}`);
    
    // Выводим общую статистику
    console.log('\n📊 Общая статистика:');
    Object.entries(allChannels).forEach(([spec, channels]) => {
        console.log(`  ${spec}: ${channels.length} каналов`);
    });
    
    const totalChannels = Object.values(allChannels).reduce((sum, channels) => sum + channels.length, 0);
    console.log(`\n🎯 Всего найдено каналов: ${totalChannels}`);
}

// Запуск скрипта
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { extractChannelsFromFile, SPECIALIZATION_FILES };
