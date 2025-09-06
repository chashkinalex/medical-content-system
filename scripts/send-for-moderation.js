#!/usr/bin/env node

/**
 * Скрипт для отправки постов на премодерацию
 * Запускается каждое воскресенье в 10:00
 */

const ModerationBot = require('../src/bots/moderation-bot');
const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');

class ModerationScheduler {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        this.moderationBot = new ModerationBot();
    }

    /**
     * Отправка постов на премодерацию
     */
    async sendPostsForModeration() {
        try {
            this.logger.info('Начинаем отправку постов на премодерацию...');

            // Получаем посты на премодерацию
            const posts = await this.database.getPostsForModeration();
            
            if (posts.length === 0) {
                this.logger.info('Нет постов для премодерации');
                return;
            }

            this.logger.info(`Найдено ${posts.length} постов для премодерации`);

            // Группируем по специальностям
            const postsBySpecialization = this.groupPostsBySpecialization(posts);
            
            // Отправляем уведомление модератору
            await this.moderationBot.notifyModerationSession();

            // Логируем статистику
            this.logStats(postsBySpecialization);

            this.logger.info('Отправка постов на премодерацию завершена');

        } catch (error) {
            this.logger.error('Ошибка при отправке постов на премодерацию:', error);
        }
    }

    /**
     * Группировка постов по специальностям
     */
    groupPostsBySpecialization(posts) {
        const grouped = {};
        
        posts.forEach(post => {
            if (!grouped[post.specialization]) {
                grouped[post.specialization] = [];
            }
            grouped[post.specialization].push(post);
        });

        return grouped;
    }

    /**
     * Логирование статистики
     */
    logStats(postsBySpecialization) {
        this.logger.info('📊 Статистика постов на премодерацию:');
        
        Object.entries(postsBySpecialization).forEach(([specialization, posts]) => {
            this.logger.info(`  ${specialization}: ${posts.length} постов`);
        });

        const totalPosts = Object.values(postsBySpecialization).reduce((sum, posts) => sum + posts.length, 0);
        this.logger.info(`  Всего: ${totalPosts} постов`);
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            await this.sendPostsForModeration();
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса премодерации:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const scheduler = new ModerationScheduler();
    scheduler.run();
}

module.exports = ModerationScheduler;
