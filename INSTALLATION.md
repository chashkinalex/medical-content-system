# 🚀 Руководство по установке Medical Content System

## 📋 Требования

### Системные требования
- **Node.js** версии 16.0.0 или выше
- **npm** версии 7.0.0 или выше
- **Git** для клонирования репозитория
- **SQLite3** (включается в Node.js)

### Операционные системы
- ✅ macOS 10.15+
- ✅ Ubuntu 18.04+
- ✅ Windows 10+
- ✅ CentOS 7+

## 🔧 Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/chashkinalex/medical-content-system.git
cd medical-content-system
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка окружения

```bash
# Копирование файла конфигурации
cp env.example .env

# Редактирование конфигурации
nano .env  # или любой другой редактор
```

### 4. Настройка переменных окружения

Отредактируйте файл `.env` и укажите необходимые параметры:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHANNEL_ID=@your_channel_username
TELEGRAM_ADMIN_ID=your_admin_user_id

# Database Configuration
DATABASE_URL=sqlite:./data/content.db

# PubMed API Configuration (опционально)
PUBMED_API_KEY=your_pubmed_api_key_here
PUBMED_EMAIL=your_email@example.com

# Настройки скоринга
SCORING_THRESHOLD=14
SCORING_MAX=25

# Расписание публикации (cron format)
PUBLICATION_SCHEDULE=0 9,15,21 * * *
```

## 🤖 Настройка Telegram Bot

### 1. Создание бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/botfather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен в `.env` файл

### 2. Настройка канала

1. Создайте Telegram канал
2. Добавьте бота в канал как администратора
3. Укажите ID канала в `.env` файле

### 3. Получение ID канала

```bash
# Добавьте бота в канал и отправьте любое сообщение
# Затем выполните:
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```

## 📊 Настройка источников контента

### 1. RSS-фиды

Отредактируйте файл `config/rss-feeds.json` для настройки источников:

```json
{
  "feeds": [
    {
      "id": "nejm",
      "name": "New England Journal of Medicine",
      "url": "https://www.nejm.org/action/showFeed?type=etoc&feed=rss",
      "level": "A",
      "specialization": "general",
      "enabled": true
    }
  ]
}
```

### 2. PubMed API (опционально)

1. Зарегистрируйтесь на [NCBI](https://www.ncbi.nlm.nih.gov/account/)
2. Получите API ключ
3. Укажите ключ в `.env` файле

## 🗄️ Настройка базы данных

Система автоматически создаст SQLite базу данных при первом запуске. База данных будет создана в папке `data/`.

### Структура базы данных

- **sources** - источники контента
- **articles** - собранные статьи
- **posts** - сгенерированные посты
- **scoring** - результаты скоринга
- **metrics** - метрики системы
- **settings** - настройки системы

## 🚀 Первый запуск

### 1. Инициализация системы

```bash
npm run setup
```

### 2. Тестирование компонентов

```bash
# Сбор контента
npm run collect

# Обработка контента
npm run process

# Скоринг контента
npm run score

# Генерация постов
npm run generate

# Публикация в Telegram
npm run publish
```

### 3. Проверка логов

```bash
# Просмотр логов
npm run logs

# Проверка статуса
npm run status
```

## 🔄 Автоматизация

### 1. Настройка cron (Linux/macOS)

```bash
# Редактирование crontab
crontab -e

# Добавление задач
# Сбор контента каждые 6 часов
0 */6 * * * cd /path/to/medical-content-system && npm run collect

# Публикация по расписанию
0 9,15,21 * * * cd /path/to/medical-content-system && npm run publish
```

### 2. Настройка Task Scheduler (Windows)

1. Откройте Task Scheduler
2. Создайте новую задачу
3. Настройте триггеры и действия
4. Укажите путь к `npm run collect` и `npm run publish`

## 📈 Мониторинг

### 1. Логи системы

```bash
# Основные логи
tail -f logs/system.log

# Логи ошибок
tail -f logs/error.log

# Логи исключений
tail -f logs/exceptions.log
```

### 2. Метрики

```bash
# Просмотр статистики
npm run analytics

# Проверка здоровья системы
npm run health
```

## 🛠️ Разработка

### 1. Режим разработки

```bash
npm run dev
```

### 2. Тестирование

```bash
npm test
```

### 3. Проверка кода

```bash
npm run lint
npm run format
```

## 🔧 Устранение неполадок

### Частые проблемы

#### 1. Ошибка подключения к Telegram

```
Error: 401 Unauthorized
```

**Решение:** Проверьте правильность токена бота в `.env` файле.

#### 2. Ошибка базы данных

```
Error: SQLITE_CANTOPEN
```

**Решение:** Убедитесь, что папка `data/` существует и доступна для записи.

#### 3. Ошибка RSS-фидов

```
Error: ETIMEDOUT
```

**Решение:** Проверьте доступность RSS-фидов и настройки сети.

### Логи отладки

```bash
# Включение подробных логов
export LOG_LEVEL=debug
npm start
```

### Сброс системы

```bash
# Удаление базы данных
rm -rf data/

# Пересоздание структуры
npm run setup
```

## 📞 Поддержка

### Получение помощи

1. **GitHub Issues**: [Создать issue](https://github.com/chashkinalex/medical-content-system/issues)
2. **Email**: alex@kafedra.agency
3. **Документация**: [README.md](README.md)

### Сообщение об ошибках

При сообщении об ошибке укажите:

1. Версию Node.js: `node --version`
2. Версию npm: `npm --version`
3. Операционную систему
4. Логи ошибки из `logs/error.log`
5. Шаги для воспроизведения ошибки

## 🔄 Обновление

### Обновление до новой версии

```bash
# Получение обновлений
git pull origin main

# Установка новых зависимостей
npm install

# Применение миграций базы данных (если есть)
npm run migrate
```

### Резервное копирование

```bash
# Создание резервной копии
npm run backup

# Восстановление из резервной копии
npm run restore
```

## ✅ Проверка установки

После установки выполните проверку:

```bash
# Проверка всех компонентов
npm run health

# Тестовый запуск
npm run test

# Проверка конфигурации
node -e "console.log('✅ Node.js работает')"
```

Если все проверки прошли успешно, система готова к работе! 🎉
