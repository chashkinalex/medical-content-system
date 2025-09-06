#!/usr/bin/env node

/**
 * Скрипт для публикации одобренных постов
 * Запускается по расписанию: 8:00, 14:00, 20:00
 */

const TelegramBot = require('node-telegram-bot-api');
const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

class PostPublisher {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        
        // Инициализация бота для публикации
        this.bot = new TelegramBot(process.env.PUBLISHING_BOT_TOKEN, { polling: false });
        
        // Конфигурация каналов
        this.channels = {
            'cardiology': process.env.CARDIOLOGY_CHANNEL_ID,
            'endocrinology': process.env.ENDOCRINOLOGY_CHANNEL_ID,
            'pediatrics': process.env.PEDIATRICS_CHANNEL_ID,
            'gastroenterology': process.env.GASTROENTEROLOGY_CHANNEL_ID,
            'gynecology': process.env.GYNECOLOGY_CHANNEL_ID,
            'neurology': process.env.NEUROLOGY_CHANNEL_ID,
            'therapy': process.env.THERAPY_CHANNEL_ID
        };

        // Расписание публикации
        this.schedule = {
            '8:00': ['research', 'guideline'],
            '14:00': ['news', 'update'],
            '20:00': ['practical', 'case']
        };
    }

    /**
     * Публикация одобренных постов
     */
    async publishApprovedPosts() {
        try {
            this.logger.info('Начинаем публикацию одобренных постов...');

            // Определяем текущее время и тип контента
            const currentTime = new Date();
            const timeKey = this.getTimeKey(currentTime);
            const contentTypes = this.schedule[timeKey] || ['general'];

            this.logger.info(`Время публикации: ${timeKey}, типы контента: ${contentTypes.join(', ')}`);

            // Получаем одобренные посты для публикации
            const posts = await this.database.getApprovedPostsForPublishing(contentTypes);
            
            if (posts.length === 0) {
                this.logger.info('Нет одобренных постов для публикации');
                return;
            }

            this.logger.info(`Найдено ${posts.length} одобренных постов для публикации`);

            // Публикуем посты
            for (const post of posts) {
                await this.publishPost(post);
                
                // Пауза между публикациями (30 секунд)
                await new Promise(resolve => setTimeout(resolve, 30000));
            }

            this.logger.info('Публикация одобренных постов завершена');

        } catch (error) {
            this.logger.error('Ошибка при публикации одобренных постов:', error);
        }
    }

    /**
     * Определение ключа времени для расписания
     */
    getTimeKey(currentTime) {
        const hour = currentTime.getHours();
        
        if (hour >= 7 && hour < 12) return '8:00';
        if (hour >= 12 && hour < 18) return '14:00';
        if (hour >= 18 && hour < 22) return '20:00';
        
        return '8:00'; // По умолчанию
    }

    /**
     * Публикация одного поста
     */
    async publishPost(post) {
        try {
            const channelId = this.channels[post.specialization];
            
            if (!channelId) {
                this.logger.warn(`Канал для специальности ${post.specialization} не настроен`);
                return;
            }

            // Форматируем пост для публикации
            const formattedPost = this.formatPostForPublishing(post);
            
            // Публикуем пост
            const message = await this.bot.sendMessage(channelId, formattedPost, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });

            // Обновляем статус поста в базе данных
            await this.database.updatePostPublishingStatus(post.id, 'published', message.message_id);

            this.logger.info(`Пост ${post.id} опубликован в канале ${post.specialization}`);

        } catch (error) {
            this.logger.error(`Ошибка при публикации поста ${post.id}:`, error);
            
            // Обновляем статус на ошибку
            await this.database.updatePostPublishingStatus(post.id, 'error', null);
        }
    }

    /**
     * Форматирование поста для публикации
     */
    formatPostForPublishing(post) {
        const emoji = this.getPostEmoji(post.type);
        const specializationEmoji = this.getSpecializationEmoji(post.specialization);
        
        return `${emoji} **${post.title}**\n\n` +
               `📋 **Суть:**\n${post.summary}\n\n` +
               `🔍 **Ключевые моменты:**\n${this.formatKeyPoints(post.key_points)}\n\n` +
               `💡 **Практическое применение:**\n${post.practical_application}\n\n` +
               `📚 **Источник:** ${post.source_name}\n` +
               `🔗 **Ссылка:** [Читать полностью](${post.source_url})\n\n` +
               `${specializationEmoji} #${post.specialization} #медицина #клиническаяпрактика`;
    }

    /**
     * Получение эмодзи для типа поста
     */
    getPostEmoji(type) {
        const emojis = {
            'research': '🔬',
            'guideline': '📋',
            'news': '📰',
            'update': '🔄',
            'practical': '💡',
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
     * Форматирование ключевых моментов
     */
    formatKeyPoints(keyPoints) {
        if (!keyPoints || keyPoints.length === 0) {
            return '• Информация будет дополнена';
        }
        
        return keyPoints.map(point => `• ${point}`).join('\n');
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            await this.publishApprovedPosts();
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса публикации:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const publisher = new PostPublisher();
    publisher.run();
}

module.exports = PostPublisher;
