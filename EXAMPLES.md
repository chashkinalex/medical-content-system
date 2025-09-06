# 📚 Примеры использования Medical Content System

## 🚀 Быстрый старт

### 1. Базовый запуск системы

```bash
# Клонирование и установка
git clone https://github.com/chashkinalex/medical-content-system.git
cd medical-content-system
npm install

# Настройка
cp env.example .env
# Отредактируйте .env файл

# Первый запуск
npm start
```

### 2. Полный цикл обработки контента

```bash
# Сбор контента из всех источников
npm run collect

# Обработка и структурирование
npm run process

# Скоринг по критериям качества
npm run score

# Генерация постов по шаблонам
npm run generate

# Публикация в Telegram
npm run publish
```

## 📥 Сбор контента

### Сбор из RSS-фидов

```javascript
const ContentCollector = require('./src/collectors/content-collector');

const collector = new ContentCollector();
await collector.initialize(config.rssFeeds);

// Сбор из всех источников
const articles = await collector.collectAll();

// Сбор из конкретного источника
const nejmArticles = await collector.collectFromSource('nejm');

// Сбор с фильтрацией
const cardiologyArticles = await collector.collectBySpecialization('cardiology');
```

### Сбор из PubMed

```javascript
// Поиск по ключевым словам
const pubmedArticles = await collector.searchPubMed({
    query: 'diabetes treatment guidelines',
    maxResults: 50,
    dateRange: '2024-01-01:2024-12-31'
});

// Поиск по журналу
const nejmArticles = await collector.searchByJournal('New England Journal of Medicine');
```

## ⚙️ Обработка контента

### Структурирование статей

```javascript
const ContentProcessor = require('./src/processors/content-processor');

const processor = new ContentProcessor();
await processor.initialize(config.postTemplates);

// Обработка одной статьи
const processedArticle = await processor.processArticle(article);

// Обработка всех необработанных статей
const results = await processor.processAll();

// Обработка с фильтрацией
const highPriorityArticles = await processor.processByPriority('high');
```

### Извлечение ключевой информации

```javascript
// Извлечение основных данных
const extractedData = await processor.extractData(article, {
    extractAuthors: true,
    extractKeywords: true,
    extractSummary: true,
    extractReferences: true
});

// Анализ содержания
const analysis = await processor.analyzeContent(article.content, {
    detectLanguage: true,
    extractTopics: true,
    calculateReadability: true
});
```

## 📊 Скоринг контента

### Автоматический скоринг

```javascript
const ContentScorer = require('./src/scorers/content-scorer');

const scorer = new ContentScorer();
await scorer.initialize(config.scoring);

// Скоринг одной статьи
const score = await scorer.scoreArticle(article);

// Скоринг всех неоцененных статей
const results = await scorer.scoreAll();

// Скоринг с весами
const customScore = await scorer.scoreWithWeights(article, {
    clinical: 6,
    evidence: 5,
    novelty: 4,
    applicability: 5,
    controversy: 5
});
```

### Ручной скоринг

```javascript
// Создание формы для ручного скоринга
const scoringForm = await scorer.createScoringForm(article);

// Сохранение результатов ручного скоринга
await scorer.saveManualScore(article.id, {
    clinical_significance: 4,
    evidence_quality: 5,
    novelty: 3,
    applicability: 4,
    controversy: 2,
    notes: 'Хорошее исследование, но ограниченная применимость в РФ'
});
```

## ✍️ Генерация постов

### Генерация по шаблонам

```javascript
const PostGenerator = require('./src/generators/post-generator');

const generator = new PostGenerator();
await generator.initialize(config.postTemplates);

// Генерация поста определенного типа
const post = await generator.generatePost(article, 'guidelines_update');

// Генерация всех типов постов
const allPosts = await generator.generateAllTypes(article);

// Генерация с кастомными параметрами
const customPost = await generator.generateCustom(article, {
    template: 'trial_analysis',
    maxLength: 1500,
    includeImages: true,
    addDisclaimer: true
});
```

### Настройка шаблонов

```javascript
// Создание нового шаблона
const newTemplate = {
    name: "Клинический обзор",
    format: "review",
    maxLength: 2000,
    structure: {
        header: "📋 **{title}**",
        summary: "**Краткое содержание:** {summary}",
        keyPoints: "**Ключевые моменты:**\n{keyPoints}",
        implications: "**Практические выводы:** {implications}",
        source: "📖 [Читать полностью]({url})"
    }
};

await generator.addTemplate('clinical_review', newTemplate);
```

## 📤 Публикация в Telegram

### Публикация постов

```javascript
const TelegramPublisher = require('./src/publishers/telegram-publisher');

const publisher = new TelegramPublisher();
await publisher.initialize(config.telegram);

// Публикация одного поста
const result = await publisher.publishPost(post);

// Публикация всех готовых постов
const results = await publisher.publishAll();

// Публикация с задержкой
await publisher.publishWithDelay(post, 5000); // 5 секунд задержки
```

### Планирование публикации

```javascript
// Планирование публикации на определенное время
await publisher.schedulePost(post, new Date('2024-12-25 09:00:00'));

// Планирование по расписанию
await publisher.scheduleByCron(post, '0 9,15,21 * * *');

// Публикация в очередь
await publisher.addToQueue(post, 'high');
```

## 📈 Аналитика и мониторинг

### Получение статистики

```javascript
const Database = require('./src/utils/database');

const db = new Database();
await db.initialize(config.database.url);

// Общая статистика
const stats = await db.getStats();

// Статистика по источникам
const sourceStats = await db.all(`
    SELECT s.name, COUNT(a.id) as articles, AVG(a.score) as avg_score
    FROM sources s
    LEFT JOIN articles a ON s.id = a.source_id
    GROUP BY s.id, s.name
    ORDER BY articles DESC
`);

// Статистика по постам
const postStats = await db.all(`
    SELECT 
        template_type,
        COUNT(*) as count,
        AVG(views) as avg_views,
        AVG(likes) as avg_likes
    FROM posts
    WHERE status = 'published'
    GROUP BY template_type
`);
```

### Мониторинг источников

```javascript
const Monitor = require('./src/utils/monitor');

const monitor = new Monitor();
await monitor.initialize();

// Проверка всех источников
const healthCheck = await monitor.checkAllSources();

// Проверка конкретного источника
const sourceHealth = await monitor.checkSource('nejm');

// Настройка уведомлений
await monitor.setupAlerts({
    email: 'admin@example.com',
    telegram: '@admin_channel',
    webhook: 'https://example.com/webhook'
});
```

## 🔄 Автоматизация

### Настройка cron задач

```bash
# Добавление в crontab
crontab -e

# Сбор контента каждые 6 часов
0 */6 * * * cd /path/to/medical-content-system && npm run collect

# Обработка контента каждый час
0 * * * * cd /path/to/medical-content-system && npm run process

# Публикация по расписанию
0 9,15,21 * * * cd /path/to/medical-content-system && npm run publish

# Очистка старых данных каждую неделю
0 2 * * 0 cd /path/to/medical-content-system && npm run cleanup
```

### Использование с PM2

```bash
# Установка PM2
npm install -g pm2

# Создание конфигурации
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'medical-content-system',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Запуск с PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🛠️ Кастомизация

### Добавление новых источников

```javascript
// Добавление нового RSS-фида
const newSource = {
    id: 'custom_journal',
    name: 'Custom Medical Journal',
    url: 'https://example.com/rss',
    level: 'B',
    specialization: 'general',
    language: 'en',
    enabled: true,
    tags: ['custom', 'journal']
};

await db.run(
    'INSERT INTO sources (name, url, type, level, specialization, language, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [newSource.name, newSource.url, 'rss', newSource.level, newSource.specialization, newSource.language, 1]
);
```

### Создание кастомных шаблонов

```javascript
// Создание шаблона для конкретной специальности
const cardiologyTemplate = {
    name: "Кардиологический обзор",
    format: "cardiology_review",
    maxLength: 1800,
    structure: {
        header: "❤️ **{title}**",
        classification: "**Классификация:** {classification}",
        riskFactors: "**Факторы риска:** {riskFactors}",
        treatment: "**Лечение:** {treatment}",
        monitoring: "**Мониторинг:** {monitoring}",
        source: "📖 [Читать в {journal}]({url})"
    },
    required: ["title", "classification", "treatment"],
    optional: ["riskFactors", "monitoring"]
};

await generator.addTemplate('cardiology_review', cardiologyTemplate);
```

### Интеграция с внешними сервисами

```javascript
// Интеграция с Notion
const NotionIntegration = require('./src/integrations/notion');

const notion = new NotionIntegration({
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID
});

// Синхронизация статей с Notion
await notion.syncArticles(articles);

// Интеграция с Airtable
const AirtableIntegration = require('./src/integrations/airtable');

const airtable = new AirtableIntegration({
    apiKey: process.env.AIRTABLE_API_KEY,
    baseId: process.env.AIRTABLE_BASE_ID
});

// Экспорт метрик в Airtable
await airtable.exportMetrics(stats);
```

## 🧪 Тестирование

### Модульные тесты

```javascript
// Тест сбора контента
describe('ContentCollector', () => {
    test('should collect articles from RSS feed', async () => {
        const collector = new ContentCollector();
        const articles = await collector.collectFromSource('nejm');
        expect(articles.length).toBeGreaterThan(0);
        expect(articles[0]).toHaveProperty('title');
        expect(articles[0]).toHaveProperty('url');
    });
});

// Тест скоринга
describe('ContentScorer', () => {
    test('should score article correctly', async () => {
        const scorer = new ContentScorer();
        const score = await scorer.scoreArticle(mockArticle);
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(25);
    });
});
```

### Интеграционные тесты

```javascript
// Тест полного цикла
describe('Full Pipeline', () => {
    test('should process article from collection to publication', async () => {
        // Сбор
        const articles = await collector.collectAll();
        expect(articles.length).toBeGreaterThan(0);
        
        // Обработка
        const processed = await processor.processAll();
        expect(processed.length).toBeGreaterThan(0);
        
        // Скоринг
        const scored = await scorer.scoreAll();
        expect(scored.length).toBeGreaterThan(0);
        
        // Генерация
        const posts = await generator.generateAll();
        expect(posts.length).toBeGreaterThan(0);
    });
});
```

## 📞 Поддержка

### Получение помощи

- **GitHub Issues**: [Создать issue](https://github.com/chashkinalex/medical-content-system/issues)
- **Email**: alex@kafedra.agency
- **Документация**: [README.md](README.md)

### Сообщество

- Присоединяйтесь к обсуждениям в GitHub Discussions
- Делитесь своими шаблонами и интеграциями
- Предлагайте улучшения и новые функции
