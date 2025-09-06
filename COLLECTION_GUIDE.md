# 📥 Руководство по сбору контента

## 🎯 Обзор системы

Система сбора контента настроена для 7 медицинских кафедр:

| Кафедра | Специальность | Каналы | Приоритетные источники |
|---------|---------------|--------|----------------------|
| **Кафедра терапии** | `therapy` | @kafedra_terapii | ACP, Annals, NEJM, BMJ |
| **Кафедра педиатрии** | `pediatrics` | @kafedra_pediatrii | AAP, Pediatrics, NEJM, Lancet |
| **Кафедра гастроэнтерологии** | `gastroenterology` | @kafedra_gastro | AGA, Gastroenterology, NEJM, Lancet |
| **Кафедра эндокринологии** | `endocrinology` | @kafedra_endocrinology | ADA, Diabetes Care, JCEM, NEJM |
| **Кафедра гинекологии** | `gynecology` | @kafedra_gyn | ACOG, Obstetrics & Gynecology, NEJM, Lancet |
| **Кафедра кардиологии** | `cardiology` | @kafedra_cardiology | ACC/AHA, EHJ, Circulation, NEJM |
| **Кафедра неврологии** | `neurology` | @kafedra_neurology | AAN, Neurology, NEJM, Lancet |

## 🚀 Быстрый старт

### 1. Первоначальная настройка

```bash
# Установка зависимостей
npm install

# Первоначальная настройка системы
npm run setup

# Инициализация источников в базе данных
npm run init:sources
```

### 2. Тестирование сбора

```bash
# Тестирование сбора контента
npm run collect:test

# Полный сбор контента
npm run collect
```

## 📊 Источники контента

### Уровни источников

- **Уровень A** - Топ-журналы, клинические рекомендации, конгрессы
- **Уровень B** - Обзоры, дайджесты, систематические обзоры
- **Уровень C** - Соцсети врачей, кейсы
- **Уровень D** - Калькуляторы, алгоритмы
- **Уровень E** - Локальные источники (Минздрав РФ)

### Специализированные источники

#### Кардиология
- **ACC/AHA** - American College of Cardiology / American Heart Association
- **EHJ** - European Heart Journal
- **Circulation** - Circulation Journal

#### Педиатрия
- **AAP** - American Academy of Pediatrics
- **Pediatrics** - Pediatrics Journal

#### Гастроэнтерология
- **AGA** - American Gastroenterological Association
- **Gastroenterology** - Gastroenterology Journal

#### Эндокринология
- **ADA** - American Diabetes Association
- **Diabetes Care** - Diabetes Care Journal
- **JCEM** - Journal of Clinical Endocrinology & Metabolism

#### Гинекология
- **ACOG** - American College of Obstetricians and Gynecologists
- **Obstetrics & Gynecology** - Obstetrics & Gynecology Journal

#### Неврология
- **AAN** - American Academy of Neurology
- **Neurology** - Neurology Journal

#### Терапия
- **ACP** - American College of Physicians
- **Annals of Internal Medicine** - Annals of Internal Medicine

## ⚙️ Конфигурация

### Настройка источников

Файл `config/rss-feeds.json` содержит конфигурацию всех источников:

```json
{
  "id": "nejm",
  "name": "New England Journal of Medicine",
  "url": "https://www.nejm.org/action/showFeed?type=etoc&feed=rss",
  "level": "A",
  "specialization": "general",
  "language": "en",
  "enabled": true,
  "updateInterval": 3600000,
  "tags": ["top-journal", "clinical", "research"]
}
```

### Настройка специальностей

Файл `config/specializations.json` содержит конфигурацию для каждой кафедры:

```json
{
  "cardiology": {
    "name": "Кафедра кардиологии",
    "telegram_channel": "@kafedra_cardiology",
    "keywords": ["cardiology", "cardiovascular", "heart", "cardiac"],
    "priority_sources": ["acc_aha", "ehj", "circulation", "nejm"],
    "scoring_weights": {
      "clinical_significance": 6,
      "evidence_quality": 5,
      "novelty": 4,
      "applicability": 5,
      "controversy": 3
    }
  }
}
```

## 🔄 Процесс сбора

### 1. Автоматический сбор

```bash
# Сбор из всех источников
npm run collect

# Сбор по специальности
node -e "
const ContentCollector = require('./src/collectors/content-collector');
const collector = new ContentCollector();
await collector.initialize(feedsConfig, specializationsConfig);
const articles = await collector.collectBySpecialization('cardiology');
console.log('Собрано статей:', articles.length);
"
```

### 2. Ручной сбор

```bash
# Сбор из конкретного источника
node -e "
const ContentCollector = require('./src/collectors/content-collector');
const collector = new ContentCollector();
await collector.initialize(feedsConfig);
const articles = await collector.collectFromSource('nejm');
console.log('Собрано статей:', articles.length);
"
```

## 📈 Мониторинг и статистика

### Просмотр статистики

```bash
# Статистика сбора
node -e "
const ContentCollector = require('./src/collectors/content-collector');
const collector = new ContentCollector();
await collector.initialize(feedsConfig);
const stats = await collector.getCollectionStats();
console.log(JSON.stringify(stats, null, 2));
"
```

### Проверка базы данных

```bash
# Подключение к базе данных
sqlite3 data/content.db

# Просмотр источников
SELECT name, specialization, enabled FROM sources;

# Просмотр статей
SELECT title, journal, specialization, published_date FROM articles ORDER BY published_date DESC LIMIT 10;

# Статистика по специальностям
SELECT specialization, COUNT(*) as count FROM articles GROUP BY specialization;
```

## 🛠️ Настройка и кастомизация

### Добавление нового источника

1. Отредактируйте `config/rss-feeds.json`
2. Добавьте новый источник:

```json
{
  "id": "new_source",
  "name": "New Medical Journal",
  "url": "https://example.com/rss",
  "level": "A",
  "specialization": "cardiology",
  "language": "en",
  "enabled": true,
  "updateInterval": 3600000,
  "tags": ["journal", "cardiology", "research"]
}
```

3. Переинициализируйте источники:

```bash
npm run init:sources
```

### Изменение расписания сбора

```bash
# Настройка cron для автоматического сбора
crontab -e

# Добавьте строку для сбора каждые 6 часов
0 */6 * * * cd /path/to/medical-content-system && npm run collect
```

### Фильтрация контента

```bash
# Сбор только высокоприоритетных источников
node -e "
const ContentCollector = require('./src/collectors/content-collector');
const collector = new ContentCollector();
await collector.initialize(feedsConfig);
const highPriorityFeeds = feedsConfig.feeds.filter(f => f.level === 'A');
const articles = await collector.collectAll({ feeds: highPriorityFeeds });
console.log('Собрано статей:', articles.length);
"
```

## 🔧 Устранение неполадок

### Частые проблемы

#### 1. Ошибка парсинга RSS

```
Error: ETIMEDOUT
```

**Решение:**
- Проверьте доступность RSS-фида
- Увеличьте timeout в настройках
- Проверьте User-Agent

#### 2. Дублирование статей

```
Error: UNIQUE constraint failed
```

**Решение:**
- Система автоматически пропускает дубликаты
- Проверьте URL статей в базе данных

#### 3. Пустые RSS-фиды

```
RSS-фид пуст: Journal Name
```

**Решение:**
- Проверьте URL RSS-фида
- Убедитесь, что фид активен
- Проверьте формат RSS

### Логи и отладка

```bash
# Просмотр логов
tail -f logs/system.log

# Подробные логи
export LOG_LEVEL=debug
npm run collect:test

# Проверка конкретного источника
node -e "
const Parser = require('rss-parser');
const parser = new Parser();
parser.parseURL('https://www.nejm.org/action/showFeed?type=etoc&feed=rss')
  .then(feed => console.log('Статей:', feed.items.length))
  .catch(err => console.error('Ошибка:', err));
"
```

## 📊 Аналитика сбора

### Метрики производительности

- **Скорость сбора**: статей в минуту
- **Успешность**: процент успешных запросов
- **Качество**: процент статей с полным контентом
- **Специализация**: распределение по кафедрам

### Отчеты

```bash
# Генерация отчета
node -e "
const Database = require('./src/utils/database');
const db = new Database();
await db.initialize('sqlite:./data/content.db');
const stats = await db.getStats();
console.log('Статистика:', JSON.stringify(stats, null, 2));
"
```

## 🚀 Следующие шаги

После настройки сбора контента:

1. **Обработка контента**: `npm run process`
2. **Скоринг**: `npm run score`
3. **Генерация постов**: `npm run generate`
4. **Публикация**: `npm run publish`

## 📞 Поддержка

- **GitHub Issues**: [Создать issue](https://github.com/chashkinalex/medical-content-system/issues)
- **Email**: alex@kafedra.agency
- **Документация**: [README.md](README.md)
