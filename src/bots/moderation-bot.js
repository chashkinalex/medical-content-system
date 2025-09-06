#!/usr/bin/env node

/**
 * Telegram бот для премодерации медицинского контента
 * Отправляет посты на премодерацию и обрабатывает решения модератора
 */

const TelegramBot = require('node-telegram-bot-api');
const Database = require('../utils/database');
const Logger = require('../utils/logger');

class ModerationBot {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        
        // Инициализация бота
        this.bot = new TelegramBot(process.env.MODERATION_BOT_TOKEN, { polling: true });
        
        // ID модератора (будет установлен при первом запуске)
        this.moderatorId = process.env.MODERATOR_TELEGRAM_ID;
        
        // Состояние модерации
        this.moderationState = new Map();
        
        this.setupHandlers();
    }

    /**
     * Настройка обработчиков команд и сообщений
     */
    setupHandlers() {
        // Команда /start
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            this.logger.info(`Модератор подключился: ${chatId}`);
            
            // Сохраняем ID модератора
            if (!this.moderatorId) {
                this.moderatorId = chatId;
                this.logger.info(`ID модератора установлен: ${chatId}`);
            }
            
            this.bot.sendMessage(chatId, 
                '🏥 **Добро пожаловать в систему премодерации медицинского контента!**\n\n' +
                '📋 **Доступные команды:**\n' +
                '/start - Начать работу\n' +
                '/moderate - Выбрать специальность для модерации\n' +
                '/status - Статус очереди модерации\n' +
                '/help - Помощь\n\n' +
                '⏰ **Расписание:**\n' +
                '• Премодерация: каждое воскресенье в 10:00\n' +
                '• Доработка: вторник и пятница\n' +
                '• Публикация: автоматически после одобрения\n\n' +
                '🎯 **Выберите специальность для модерации:**'
            );
            
            // Показываем кнопки выбора специальности
            this.showSpecializationMenu(chatId);
        });

        // Команда /moderate - выбор специальности
        this.bot.onText(/\/moderate/, async (msg) => {
            const chatId = msg.chat.id;
            this.showSpecializationMenu(chatId);
        });

        // Команда /status - статус очереди
        this.bot.onText(/\/status/, async (msg) => {
            const chatId = msg.chat.id;
            await this.showModerationStatus(chatId);
        });

        // Команда /help
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId, 
                '📚 **Помощь по системе премодерации**\n\n' +
                '🔍 **Как работает премодерация:**\n' +
                '1. Система генерирует посты ежедневно\n' +
                '2. Каждое воскресенье вы получаете посты на премодерацию\n' +
                '3. Выбираете: ✅ Да / ❌ Нет / 🔧 На доработку\n' +
                '4. Одобренные посты публикуются автоматически\n\n' +
                '📝 **Критерии оценки:**\n' +
                '• Медицинская точность\n' +
                '• Актуальность информации\n' +
                '• Практическая применимость\n' +
                '• Соответствие аудитории\n\n' +
                '⏰ **Расписание:**\n' +
                '• Премодерация: воскресенье 10:00\n' +
                '• Доработка: вторник и пятница\n' +
                '• Публикация: 8:00, 14:00, 20:00'
            );
        });

        // Обработка callback кнопок
        this.bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;
            const chatId = message.chat.id;
            
            // Обработка выбора специальности
            if (data.startsWith('specialization_')) {
                const specialization = data.replace('specialization_', '');
                await this.startModerationSession(chatId, specialization);
            }
            // Обработка решений модератора
            else if (data.startsWith('approve_') || data.startsWith('reject_') || data.startsWith('revision_')) {
                await this.handleModeratorDecision(chatId, data, message);
            }
            // Обработка комментариев для доработки
            else if (data.startsWith('comment_')) {
                const postId = data.replace('comment_', '');
                await this.requestRevisionComment(chatId, postId);
            }
        });

        // Обработка текстовых сообщений (комментарии для доработки)
        this.bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            
            // Проверяем, ожидается ли комментарий для доработки
            if (this.moderationState.has(chatId) && this.moderationState.get(chatId).waitingForComment) {
                const state = this.moderationState.get(chatId);
                await this.saveRevisionComment(chatId, state.postId, text);
            }
        });

        // Обработка ошибок
        this.bot.on('error', (error) => {
            this.logger.error('Ошибка Telegram бота:', error);
        });
    }

    /**
     * Показать меню выбора специальности
     */
    async showSpecializationMenu(chatId) {
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '❤️ Кардиология', callback_data: 'specialization_cardiology' },
                    { text: '🩺 Эндокринология', callback_data: 'specialization_endocrinology' }
                ],
                [
                    { text: '👶 Педиатрия', callback_data: 'specialization_pediatrics' },
                    { text: '🫀 Гастроэнтерология', callback_data: 'specialization_gastroenterology' }
                ],
                [
                    { text: '👩 Гинекология', callback_data: 'specialization_gynecology' },
                    { text: '🧠 Неврология', callback_data: 'specialization_neurology' }
                ],
                [
                    { text: '🩹 Терапия', callback_data: 'specialization_therapy' }
                ]
            ]
        };

        this.bot.sendMessage(chatId, 
            '🎯 **Выберите специальность для модерации:**\n\n' +
            'Выберите специальность, посты которой вы хотите модерировать.',
            { reply_markup: keyboard }
        );
    }

    /**
     * Начало сессии премодерации для конкретной специальности
     */
    async startModerationSession(chatId, specialization) {
        try {
            // Получаем посты на премодерацию для конкретной специальности
            const posts = await this.database.getPostsForModerationBySpecialization(specialization);
            
            if (posts.length === 0) {
                this.bot.sendMessage(chatId, 
                    `📭 **Очередь премодерации для ${this.getSpecializationName(specialization)} пуста**\n\n` +
                    'Все посты уже обработаны или система еще не сгенерировала новые посты для этой специальности.'
                );
                return;
            }

            this.bot.sendMessage(chatId, 
                `📋 **Начинаем сессию премодерации: ${this.getSpecializationName(specialization)}**\n\n` +
                `📊 **Статистика:**\n` +
                `• Постов на премодерацию: ${posts.length}\n` +
                `• Специальность: ${this.getSpecializationName(specialization)}\n\n` +
                `⏰ **Время начала:** ${new Date().toLocaleString('ru-RU')}\n\n` +
                `🚀 **Отправляем первый пост...**`
            );

            // Отправляем посты по одному
            for (let i = 0; i < posts.length; i++) {
                const post = posts[i];
                await this.sendPostForModeration(chatId, post, i + 1, posts.length);
                
                // Пауза между постами (2 секунды)
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            this.bot.sendMessage(chatId, 
                '✅ **Сессия премодерации завершена!**\n\n' +
                '📊 **Результаты будут обработаны автоматически:**\n' +
                '• Одобренные посты → публикация\n' +
                '• Отклоненные посты → генерация замены\n' +
                '• Посты на доработку → очередь доработки\n\n' +
                '📈 **Статистику можно посмотреть командой /status**'
            );

        } catch (error) {
            this.logger.error('Ошибка при начале сессии премодерации:', error);
            this.bot.sendMessage(chatId, 
                '❌ **Ошибка при начале сессии премодерации**\n\n' +
                'Попробуйте позже или обратитесь к администратору.'
            );
        }
    }

    /**
     * Отправка поста на премодерацию
     */
    async sendPostForModeration(chatId, post, currentIndex, totalCount) {
        try {
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Да', callback_data: `approve_${post.id}` },
                        { text: '❌ Точно нет', callback_data: `reject_${post.id}` }
                    ],
                    [
                        { text: '🔧 На доработку', callback_data: `revision_${post.id}` }
                    ]
                ]
            };

            const message = 
                `🏥 **ПОСТ НА ПРЕМОДЕРАЦИЮ** (${currentIndex}/${totalCount})\n\n` +
                `📋 **Заголовок:** ${post.title}\n` +
                `📚 **Специальность:** ${post.specialization}\n` +
                `⭐ **Скоринг:** ${post.score}/25\n` +
                `🔗 **Источник:** ${post.source_name}\n` +
                `📅 **Дата:** ${new Date(post.published_date).toLocaleDateString('ru-RU')}\n\n` +
                `📝 **Содержание:**\n` +
                `${post.content}\n\n` +
                `❓ **Публикуем пост?**`;

            await this.bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

            // Сохраняем состояние модерации
            this.moderationState.set(post.id, {
                post: post,
                messageId: null, // Будет установлено при ответе
                status: 'pending'
            });

        } catch (error) {
            this.logger.error(`Ошибка при отправке поста ${post.id}:`, error);
        }
    }

    /**
     * Обработка решения модератора
     */
    async handleModeratorDecision(chatId, data, message) {
        try {
            const [action, postId] = data.split('_');
            const postIdInt = parseInt(postId);
            
            if (!this.moderationState.has(postIdInt)) {
                this.bot.answerCallbackQuery(message.id, {
                    text: '❌ Пост уже обработан или не найден',
                    show_alert: true
                });
                return;
            }

            const moderationData = this.moderationState.get(postIdInt);
            const post = moderationData.post;

            // Обновляем статус в базе данных
            await this.database.updatePostModerationStatus(postIdInt, action, chatId);

            // Отправляем подтверждение
            let responseText = '';
            let responseEmoji = '';

            switch (action) {
                case 'approve':
                    responseText = '✅ **Пост одобрен!**\n\nПост будет опубликован автоматически по расписанию.';
                    responseEmoji = '✅';
                    break;
                case 'reject':
                    responseText = '❌ **Пост отклонен!**\n\nСистема сгенерирует замену автоматически.';
                    responseEmoji = '❌';
                    break;
                case 'revision':
                    responseText = '🔧 **Пост отправлен на доработку!**\n\nТеперь укажите, что именно нужно доработать.';
                    responseEmoji = '🔧';
                    
                    // Запрашиваем комментарий для доработки
                    await this.requestRevisionComment(chatId, postIdInt);
                    break;
            }

            // Отвечаем на callback
            this.bot.answerCallbackQuery(message.id, {
                text: responseText,
                show_alert: true
            });

            // Редактируем сообщение с результатом
            const editedMessage = 
                `🏥 **ПОСТ ОБРАБОТАН** (${responseEmoji})\n\n` +
                `📋 **Заголовок:** ${post.title}\n` +
                `📚 **Специальность:** ${post.specialization}\n` +
                `⭐ **Скоринг:** ${post.score}/25\n` +
                `🔗 **Источник:** ${post.source_name}\n\n` +
                `📝 **Содержание:**\n` +
                `${post.content}\n\n` +
                `✅ **Решение:** ${responseText}`;

            await this.bot.editMessageText(editedMessage, {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown'
            });

            // Удаляем из состояния
            this.moderationState.delete(postIdInt);

            this.logger.info(`Модератор ${chatId} принял решение ${action} для поста ${postIdInt}`);

        } catch (error) {
            this.logger.error('Ошибка при обработке решения модератора:', error);
            this.bot.answerCallbackQuery(message.id, {
                text: '❌ Ошибка при обработке решения',
                show_alert: true
            });
        }
    }

    /**
     * Показать статус очереди модерации
     */
    async showModerationStatus(chatId) {
        try {
            const stats = await this.database.getModerationStats();
            
            const message = 
                `📊 **Статус системы премодерации**\n\n` +
                `📋 **Очередь модерации:**\n` +
                `• Ожидают премодерации: ${stats.pending}\n` +
                `• Одобрено: ${stats.approved}\n` +
                `• Отклонено: ${stats.rejected}\n` +
                `• На доработке: ${stats.revision}\n\n` +
                `📈 **За последние 7 дней:**\n` +
                `• Всего обработано: ${stats.total_week}\n` +
                `• Процент одобрения: ${stats.approval_rate}%\n\n` +
                `⏰ **Следующая сессия:**\n` +
                `• Премодерация: воскресенье 10:00\n` +
                `• Доработка: вторник и пятница\n\n` +
                `🔗 **Управление:**\n` +
                `/moderate - Начать сессию премодерации\n` +
                `/help - Помощь`;

            this.bot.sendMessage(chatId, message);

        } catch (error) {
            this.logger.error('Ошибка при получении статуса модерации:', error);
            this.bot.sendMessage(chatId, 
                '❌ **Ошибка при получении статуса**\n\n' +
                'Попробуйте позже или обратитесь к администратору.'
            );
        }
    }

    /**
     * Отправка уведомления о начале сессии премодерации
     */
    async notifyModerationSession() {
        if (!this.moderatorId) {
            this.logger.warn('ID модератора не установлен, уведомление не отправлено');
            return;
        }

        try {
            const stats = await this.database.getModerationStats();
            
            this.bot.sendMessage(this.moderatorId, 
                `🔔 **Уведомление о сессии премодерации**\n\n` +
                `📊 **Статистика:**\n` +
                `• Постов на премодерацию: ${stats.pending}\n` +
                `• Специальностей: ${stats.specializations}\n\n` +
                `⏰ **Время:** ${new Date().toLocaleString('ru-RU')}\n\n` +
                `🚀 **Для начала сессии используйте команду /moderate**`
            );
        } catch (error) {
            this.logger.error('Ошибка при отправке уведомления:', error);
        }
    }

    /**
     * Запуск бота
     */
    async start() {
        try {
            await this.database.initialize();
            this.logger.info('Telegram бот для премодерации запущен');
            
            // Отправляем уведомление о запуске
            if (this.moderatorId) {
                this.bot.sendMessage(this.moderatorId, 
                    '🚀 **Система премодерации запущена!**\n\n' +
                    'Бот готов к работе. Используйте /moderate для начала сессии премодерации.'
                );
            }
        } catch (error) {
            this.logger.error('Ошибка при запуске бота премодерации:', error);
        }
    }

    /**
     * Запрос комментария для доработки
     */
    async requestRevisionComment(chatId, postId) {
        try {
            // Устанавливаем состояние ожидания комментария
            this.moderationState.set(chatId, {
                waitingForComment: true,
                postId: postId
            });

            this.bot.sendMessage(chatId, 
                '📝 **Укажите, что именно нужно доработать:**\n\n' +
                'Напишите подробный комментарий о том, что нужно исправить или улучшить в посте.\n\n' +
                'Примеры:\n' +
                '• "Добавить практические рекомендации по дозировке"\n' +
                '• "Упростить медицинскую терминологию"\n' +
                '• "Добавить информацию о противопоказаниях"\n' +
                '• "Сократить текст до 200 слов"\n\n' +
                '💡 **Ваш комментарий будет передан команде доработки.**'
            );
        } catch (error) {
            this.logger.error('Ошибка при запросе комментария доработки:', error);
        }
    }

    /**
     * Сохранение комментария для доработки
     */
    async saveRevisionComment(chatId, postId, comment) {
        try {
            // Сохраняем комментарий в базе данных
            await this.database.saveRevisionComment(postId, comment, chatId);

            // Очищаем состояние ожидания
            this.moderationState.delete(chatId);

            this.bot.sendMessage(chatId, 
                '✅ **Комментарий для доработки сохранен!**\n\n' +
                `📝 **Ваш комментарий:**\n${comment}\n\n` +
                '🔧 **Пост будет передан команде доработки во вторник или пятницу.**\n\n' +
                '📋 **Для продолжения модерации используйте /moderate**'
            );

            this.logger.info(`Комментарий доработки сохранен для поста ${postId}: ${comment}`);

        } catch (error) {
            this.logger.error('Ошибка при сохранении комментария доработки:', error);
            this.bot.sendMessage(chatId, 
                '❌ **Ошибка при сохранении комментария**\n\n' +
                'Попробуйте еще раз или обратитесь к администратору.'
            );
        }
    }

    /**
     * Получение названия специальности
     */
    getSpecializationName(specialization) {
        const names = {
            'cardiology': 'Кардиология',
            'endocrinology': 'Эндокринология',
            'pediatrics': 'Педиатрия',
            'gastroenterology': 'Гастроэнтерология',
            'gynecology': 'Гинекология',
            'neurology': 'Неврология',
            'therapy': 'Терапия'
        };
        return names[specialization] || specialization;
    }

    /**
     * Остановка бота
     */
    async stop() {
        try {
            this.bot.stopPolling();
            this.logger.info('Telegram бот для премодерации остановлен');
        } catch (error) {
            this.logger.error('Ошибка при остановке бота премодерации:', error);
        }
    }
}

// Запуск бота если файл выполняется напрямую
if (require.main === module) {
    const bot = new ModerationBot();
    bot.start();

    // Обработка сигналов завершения
    process.on('SIGINT', async () => {
        console.log('Получен сигнал SIGINT, останавливаем бота...');
        await bot.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Получен сигнал SIGTERM, останавливаем бота...');
        await bot.stop();
        process.exit(0);
    });
}

module.exports = ModerationBot;
