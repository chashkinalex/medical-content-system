#!/usr/bin/env node

/**
 * Скрипт для работы с очередью доработки постов
 * Запускается каждые 3 дня (вторник и пятница)
 */

const Database = require('../src/utils/database');
const Logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

class RevisionQueue {
    constructor() {
        this.logger = new Logger();
        this.database = new Database();
        this.revisionDir = path.join(__dirname, '../data/revisions');
    }

    /**
     * Создание файлов для доработки
     */
    async createRevisionFiles() {
        try {
            this.logger.info('Создаем файлы для доработки постов...');

            // Создаем директорию для доработки
            if (!fs.existsSync(this.revisionDir)) {
                fs.mkdirSync(this.revisionDir, { recursive: true });
            }

            // Получаем посты на доработку
            const posts = await this.database.getPostsForRevision();
            
            if (posts.length === 0) {
                this.logger.info('Нет постов для доработки');
                return;
            }

            this.logger.info(`Найдено ${posts.length} постов для доработки`);

            // Создаем файлы для каждого поста
            for (const post of posts) {
                await this.createRevisionFile(post);
            }

            // Создаем индексный файл
            await this.createIndexFile(posts);

            this.logger.info('Файлы для доработки созданы');

        } catch (error) {
            this.logger.error('Ошибка при создании файлов для доработки:', error);
        }
    }

    /**
     * Создание файла для доработки поста
     */
    async createRevisionFile(post) {
        try {
            const fileName = `post_${post.id}_${post.specialization}.md`;
            const filePath = path.join(this.revisionDir, fileName);
            
            const content = this.generateRevisionFileContent(post);
            
            fs.writeFileSync(filePath, content, 'utf8');
            
            this.logger.info(`Создан файл для доработки: ${fileName}`);

        } catch (error) {
            this.logger.error(`Ошибка при создании файла для поста ${post.id}:`, error);
        }
    }

    /**
     * Генерация содержимого файла для доработки
     */
    generateRevisionFileContent(post) {
        return `# Доработка поста ${post.id}

## 📋 Информация о посте

- **ID:** ${post.id}
- **Заголовок:** ${post.title}
- **Специальность:** ${post.specialization}
- **Тип:** ${post.type}
- **Скоринг:** ${post.score}/25
- **Источник:** ${post.source_name}
- **URL:** ${post.source_url}
- **Дата создания:** ${new Date(post.created_date).toLocaleString('ru-RU')}
- **Дата отправки на доработку:** ${new Date().toLocaleString('ru-RU')}

## 📝 Оригинальное содержание

${post.content}

## 🔧 Задачи для доработки

- [ ] Проверить медицинскую точность
- [ ] Улучшить структуру поста
- [ ] Добавить практические рекомендации
- [ ] Проверить соответствие аудитории
- [ ] Оптимизировать длину поста
- [ ] Добавить визуальные элементы

## 📝 Заметки модератора

${post.moderator_notes || 'Заметки не добавлены'}

## ✏️ Доработанное содержание

<!-- Внесите изменения здесь -->

## 📊 Критерии оценки

- **Медицинская точность:** ⭐⭐⭐⭐⭐
- **Практическая применимость:** ⭐⭐⭐⭐⭐
- **Соответствие аудитории:** ⭐⭐⭐⭐⭐
- **Структура и читаемость:** ⭐⭐⭐⭐⭐

## ✅ Чек-лист перед отправкой

- [ ] Медицинская информация проверена
- [ ] Пост соответствует формату канала
- [ ] Добавлены практические рекомендации
- [ ] Проверена грамматика и стиль
- [ ] Оптимизирована длина поста
- [ ] Добавлены необходимые хештеги

---
*Файл создан автоматически системой премодерации*
*Дата создания: ${new Date().toLocaleString('ru-RU')}*
`;
    }

    /**
     * Создание индексного файла
     */
    async createIndexFile(posts) {
        try {
            const indexPath = path.join(this.revisionDir, 'README.md');
            
            const content = `# Очередь доработки постов

## 📊 Статистика

- **Всего постов на доработку:** ${posts.length}
- **Дата создания:** ${new Date().toLocaleString('ru-RU')}
- **Следующая сессия доработки:** ${this.getNextRevisionDate()}

## 📋 Список постов

${posts.map(post => 
    `### ${post.specialization} - ${post.title}
- **ID:** ${post.id}
- **Тип:** ${post.type}
- **Скоринг:** ${post.score}/25
- **Файл:** [post_${post.id}_${post.specialization}.md](./post_${post.id}_${post.specialization}.md)
- **Источник:** ${post.source_name}
`
).join('\n')}

## 🔧 Инструкции по доработке

1. **Откройте файл поста** для доработки
2. **Внесите изменения** в раздел "Доработанное содержание"
3. **Заполните критерии оценки** (звездочки)
4. **Отметьте выполненные задачи** в чек-листе
5. **Сохраните файл** после завершения

## 📤 Отправка доработанных постов

После завершения доработки:

1. Запустите скрипт обработки доработанных постов:
   \`\`\`bash
   node scripts/process-revisions.js
   \`\`\`

2. Доработанные посты будут отправлены на повторную премодерацию

## ⏰ Расписание

- **Доработка:** Вторник и пятница
- **Премодерация:** Воскресенье 10:00
- **Публикация:** 8:00, 14:00, 20:00

---
*Файл создан автоматически системой премодерации*
`;
            
            fs.writeFileSync(indexPath, content, 'utf8');
            
            this.logger.info('Создан индексный файл для доработки');

        } catch (error) {
            this.logger.error('Ошибка при создании индексного файла:', error);
        }
    }

    /**
     * Получение даты следующей сессии доработки
     */
    getNextRevisionDate() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        // Вторник = 2, Пятница = 5
        let nextRevisionDay;
        if (dayOfWeek < 2) {
            nextRevisionDay = 2; // Вторник
        } else if (dayOfWeek < 5) {
            nextRevisionDay = 5; // Пятница
        } else {
            nextRevisionDay = 2; // Следующий вторник
        }
        
        const daysUntilNext = (nextRevisionDay - dayOfWeek + 7) % 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntilNext);
        
        return nextDate.toLocaleDateString('ru-RU');
    }

    /**
     * Обработка доработанных постов
     */
    async processRevisedPosts() {
        try {
            this.logger.info('Обрабатываем доработанные посты...');

            // Получаем все файлы доработки
            const files = fs.readdirSync(this.revisionDir)
                .filter(file => file.startsWith('post_') && file.endsWith('.md'))
                .filter(file => file !== 'README.md');

            if (files.length === 0) {
                this.logger.info('Нет файлов для обработки');
                return;
            }

            this.logger.info(`Найдено ${files.length} файлов для обработки`);

            // Обрабатываем каждый файл
            for (const file of files) {
                await this.processRevisionFile(file);
            }

            this.logger.info('Обработка доработанных постов завершена');

        } catch (error) {
            this.logger.error('Ошибка при обработке доработанных постов:', error);
        }
    }

    /**
     * Обработка одного файла доработки
     */
    async processRevisionFile(fileName) {
        try {
            const filePath = path.join(this.revisionDir, fileName);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Извлекаем ID поста из имени файла
            const postId = parseInt(fileName.match(/post_(\d+)_/)[1]);
            
            // Извлекаем доработанное содержание
            const revisedContent = this.extractRevisedContent(content);
            
            if (!revisedContent) {
                this.logger.warn(`Файл ${fileName} не содержит доработанного содержания`);
                return;
            }

            // Обновляем пост в базе данных
            await this.database.updateRevisedPost(postId, revisedContent);
            
            // Перемещаем файл в архив
            const archiveDir = path.join(this.revisionDir, 'archive');
            if (!fs.existsSync(archiveDir)) {
                fs.mkdirSync(archiveDir, { recursive: true });
            }
            
            const archivePath = path.join(archiveDir, fileName);
            fs.renameSync(filePath, archivePath);
            
            this.logger.info(`Пост ${postId} успешно доработан и отправлен на повторную премодерацию`);

        } catch (error) {
            this.logger.error(`Ошибка при обработке файла ${fileName}:`, error);
        }
    }

    /**
     * Извлечение доработанного содержания из файла
     */
    extractRevisedContent(content) {
        const startMarker = '## ✏️ Доработанное содержание';
        const endMarker = '## 📊 Критерии оценки';
        
        const startIndex = content.indexOf(startMarker);
        const endIndex = content.indexOf(endMarker);
        
        if (startIndex === -1 || endIndex === -1) {
            return null;
        }
        
        const revisedContent = content.substring(startIndex + startMarker.length, endIndex)
            .replace(/<!-- Внесите изменения здесь -->/g, '')
            .trim();
        
        return revisedContent || null;
    }

    /**
     * Запуск процесса
     */
    async run() {
        try {
            await this.database.initialize();
            
            // Проверяем аргументы командной строки
            const action = process.argv[2];
            
            if (action === 'create') {
                await this.createRevisionFiles();
            } else if (action === 'process') {
                await this.processRevisedPosts();
            } else {
                this.logger.info('Использование: node revision-queue.js [create|process]');
            }
        } catch (error) {
            this.logger.error('Ошибка при запуске процесса доработки:', error);
        }
    }
}

// Запуск если файл выполняется напрямую
if (require.main === module) {
    const revisionQueue = new RevisionQueue();
    revisionQueue.run();
}

module.exports = RevisionQueue;
