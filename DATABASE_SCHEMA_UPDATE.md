# 🗄️ Обновление схемы базы данных

## 🎯 Обзор изменений

Схема базы данных была полностью обновлена для поддержки всех функций системы обработки медицинского контента, включая премодерацию, скоринг и генерацию постов.

## 📊 Обновленные таблицы

### **1. sources (Источники контента)**

#### **Новые поля:**
- `tags` - Теги источника (JSON)
- `update_interval` - Интервал обновления (мс)
- `last_error` - Последняя ошибка
- `error_count` - Счетчик ошибок
- `success_count` - Счетчик успешных сборов

### **2. articles (Статьи)**

#### **Новые поля:**
- `content_hash` - MD5 хеш контента для дедупликации
- `word_count` - Количество слов
- `reading_time` - Время чтения (минуты)
- `language` - Язык контента (ru/en/unknown)
- `content_type` - Тип контента (research/guideline/news/case)
- `content_category` - Категория контента
- `keywords` - Ключевые слова (JSON)
- `quality_score` - Базовый скоринг качества (0-10)
- `processed_date` - Дата обработки
- `scored_date` - Дата скоринга
- `source_name` - Название источника
- `source_url` - URL источника

### **3. posts (Посты)**

#### **Новые поля:**
- `specialization` - Медицинская специальность
- `post_type` - Тип поста (research/guideline/news/case)
- `summary` - Краткое содержание
- `key_points` - Ключевые моменты (JSON)
- `practical_application` - Практическое применение
- `hashtags` - Хештеги (JSON)
- `word_count` - Количество слов
- `reading_time` - Время чтения
- `generated_date` - Дата генерации
- `moderation_status` - Статус премодерации (pending/approved/rejected/revision)
- `moderator_id` - ID модератора
- `moderator_decision` - Решение модератора
- `moderator_notes` - Заметки модератора
- `decision_date` - Дата решения
- `revision_comment` - Комментарий для доработки
- `revision_status` - Статус доработки (none/pending/completed)
- `comments` - Количество комментариев
- `forwards` - Количество пересылок

### **4. scoring (Скоринг)**

#### **Новые поля:**
- `scientific_basis` - Научная обоснованность (0-10)
- `relevance` - Актуальность (0-8)
- `practicality` - Практическая применимость (0-7)
- `quality_level` - Уровень качества (A/B/C/D)
- `breakdown` - Детальная разбивка (JSON)
- `source_quality` - Качество источника
- `evidence_level` - Уровень доказательности
- `freshness` - Свежесть публикации
- `clinical_applicability` - Клиническая применимость
- `methodology_quality` - Качество методологии

## 🆕 Новые таблицы

### **1. moderation_queue (Очередь премодерации)**
```sql
CREATE TABLE moderation_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    specialization TEXT NOT NULL,
    score INTEGER NOT NULL,
    source_url TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    moderator_decision TEXT,
    moderator_notes TEXT,
    decision_date DATETIME,
    FOREIGN KEY (post_id) REFERENCES posts (id)
);
```

### **2. revision_queue (Очередь доработки)**
```sql
CREATE TABLE revision_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    original_content TEXT NOT NULL,
    revision_notes TEXT,
    revision_comment TEXT,
    status TEXT DEFAULT 'pending',
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_date DATETIME,
    FOREIGN KEY (post_id) REFERENCES posts (id)
);
```

### **3. specialization_metrics (Метрики по специальностям)**
```sql
CREATE TABLE specialization_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    specialization TEXT NOT NULL,
    date DATE NOT NULL,
    articles_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    published_count INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    moderation_count INTEGER DEFAULT 0,
    revision_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(specialization, date)
);
```

### **4. system_logs (Логи системы)**
```sql
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    component TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **5. telegram_config (Конфигурация Telegram ботов)**
```sql
CREATE TABLE telegram_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_type TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    channel_id TEXT,
    enabled BOOLEAN DEFAULT 1,
    last_activity DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **6. publication_stats (Статистика публикаций)**
```sql
CREATE TABLE publication_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    message_id INTEGER,
    published_date DATETIME NOT NULL,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    forwards INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts (id)
);
```

## 🔍 Новые индексы

### **Для статей:**
- `idx_articles_content_hash` - Поиск по хешу контента
- `idx_articles_language` - Фильтрация по языку
- `idx_articles_content_type` - Фильтрация по типу контента
- `idx_articles_processed_date` - Сортировка по дате обработки
- `idx_articles_scored_date` - Сортировка по дате скоринга

### **Для постов:**
- `idx_posts_specialization` - Фильтрация по специальности
- `idx_posts_post_type` - Фильтрация по типу поста
- `idx_posts_moderation_status` - Статус премодерации
- `idx_posts_generated_date` - Дата генерации

### **Для скоринга:**
- `idx_scoring_quality_level` - Уровень качества
- `idx_scoring_total_score` - Итоговый скоринг

### **Для очередей:**
- `idx_moderation_queue_status` - Статус премодерации
- `idx_moderation_queue_specialization` - Специальность
- `idx_revision_queue_status` - Статус доработки

## ⚙️ Новые настройки

### **Обработка контента:**
- `content_processing_batch_size` - Размер пакета (50)
- `duplicate_threshold` - Порог дедупликации (0.85)
- `max_content_length` - Максимальная длина (50000)
- `min_content_length` - Минимальная длина (100)
- `supported_languages` - Поддерживаемые языки (ru,en)

### **Скоринг:**
- `scoring_threshold_high` - Порог высокого качества (20)
- `scoring_threshold_medium` - Порог среднего качества (15)
- `scoring_threshold_low` - Порог низкого качества (10)
- `quality_score_weights` - Веса скоринга (JSON)

### **Премодерация:**
- `max_posts_per_specialization` - Максимум постов на специальность (5)
- `moderation_session_duration` - Длительность сессии (120 мин)
- `revision_session_frequency` - Частота доработки (3 дня)

### **Публикация:**
- `telegram_posting_schedule` - Расписание (8:00,14:00,20:00)
- `content_retention_processed` - Хранение обработанного (90 дней)
- `content_retention_scored` - Хранение оцененного (180 дней)

## 🚀 Команды обновления

### **Обновление схемы:**
```bash
# Обновление с резервной копией
npm run update:database -- --backup

# Обычное обновление
npm run update:database
```

### **Проверка целостности:**
Скрипт автоматически проверяет:
- Существование всех таблиц
- Наличие критических колонок
- Целостность индексов

## 📊 Новые методы базы данных

### **Для обработки контента:**
- `getRawArticles()` - Необработанные статьи
- `getUnscoredArticles()` - Неоцененные статьи
- `getArticlesForPostGeneration()` - Статьи для генерации
- `saveProcessedArticle()` - Сохранение обработанной статьи
- `saveArticleScore()` - Сохранение скоринга

### **Для премодерации:**
- `getPostsForModeration()` - Посты на премодерацию
- `getPostsForModerationBySpecialization()` - По специальности
- `updatePostModerationStatus()` - Обновление статуса
- `saveRevisionComment()` - Сохранение комментария

### **Для публикации:**
- `getApprovedPostsForPublishing()` - Одобренные посты
- `updatePostPublishingStatus()` - Статус публикации
- `getPostsForRevision()` - Посты на доработку
- `updateRevisedPost()` - Обновление доработанного

### **Для статистики:**
- `getModerationStats()` - Статистика премодерации
- `getPostsBySpecialization()` - По специальностям
- `getScoreDistribution()` - Распределение скоринга
- `getRawArticlesCount()` - Количество необработанных

### **Для тестирования:**
- `getTestSources()` - Тестовые источники
- `cleanupTestData()` - Очистка тестовых данных
- `findArticleByUrl()` - Поиск по URL
- `findArticleByHash()` - Поиск по хешу
- `findSimilarTitles()` - Поиск похожих заголовков

## 🎯 Результат обновления

### **Поддержка всех функций:**
- ✅ **Обработка контента** с дедупликацией и классификацией
- ✅ **Скоринг** с детальной разбивкой по критериям
- ✅ **Генерация постов** с шаблонами и адаптацией
- ✅ **Премодерация** по специальностям с комментариями
- ✅ **Публикация** с отслеживанием метрик
- ✅ **Доработка** с системой комментариев

### **Производительность:**
- ✅ **Индексы** для быстрого поиска и фильтрации
- ✅ **Оптимизированные запросы** для больших объемов данных
- ✅ **Пакетная обработка** с настраиваемыми размерами
- ✅ **Кэширование** часто используемых данных

### **Масштабируемость:**
- ✅ **Модульная структура** таблиц
- ✅ **Гибкие настройки** через конфигурацию
- ✅ **Расширяемость** для новых функций
- ✅ **Мониторинг** через логи и метрики

Обновленная схема базы данных полностью поддерживает все функции системы обработки медицинского контента! 🏥✨
