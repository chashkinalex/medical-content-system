# 📱 Настройка Telegram API для мониторинга каналов

## 🎯 Обзор

Система мониторинга Telegram каналов настроена и готова к работе. Мы извлекли **111 каналов** из 7 медицинских специальностей и настроили инфраструктуру для их мониторинга.

## 📊 Статистика каналов

| Специальность | Количество каналов | Примеры каналов |
|---------------|-------------------|-----------------|
| **Кардиология** | 12 | @cardiogram_uz, @cardiology_info, @profcardiologist |
| **Педиатрия** | 15 | @pomoshnik_pediatra, @pediatrics_rus, @profpediatrician |
| **Гастроэнтерология** | 8 | @profgastroenterologist, @bakaevadoc, @endoscopy_surgery |
| **Эндокринология** | 11 | @profendocrinologist, @true_endo, @endocommunity |
| **Гинекология** | 9 | @profgynecologist, @Gynecology_school, @ruivf |
| **Неврология** | 33 | @nervos, @profneurologist, @neurologyforever |
| **Терапия** | 23 | @pomoshnik_terapevta, @profphysician, @ebmedicine |

**Всего каналов: 111**

## 🔧 Настройка Telegram API

### 1. Получение API credentials

1. **Перейдите на https://my.telegram.org**
2. **Войдите в аккаунт** используя ваш номер телефона
3. **Перейдите в раздел "API development tools"**
4. **Создайте новое приложение:**
   - App title: `Medical Content System`
   - Short name: `medical-content`
   - Platform: `Desktop`
   - Description: `System for monitoring medical Telegram channels`

5. **Сохраните полученные данные:**
   - `api_id` - числовой идентификатор
   - `api_hash` - строковый хеш

### 2. Настройка переменных окружения

Отредактируйте файл `.env.telegram`:

```env
# Telegram API Configuration
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=+1234567890
TELEGRAM_SESSION_STRING=your_session_string_here

# Telegram-to-RSS Configuration
UPDATE_INTERVAL=300000
MAX_POSTS_PER_CHANNEL=50
LOG_LEVEL=info
```

### 3. Получение Session String

Для получения session string выполните:

```bash
# Запустите интерактивную настройку
node scripts/get-telegram-session.js
```

Или используйте готовый session string, если у вас есть.

## 🚀 Запуск системы

### 1. Запуск telegram-to-rss

```bash
# Запуск системы
npm run start:telegram

# Или напрямую
./scripts/start-telegram-to-rss.sh
```

### 2. Проверка работы

После запуска RSS-фиды будут доступны по адресам:

- **Кардиология**: http://localhost:8080/cardiology
- **Педиатрия**: http://localhost:8080/pediatrics
- **Гастроэнтерология**: http://localhost:8080/gastroenterology
- **Эндокринология**: http://localhost:8080/endocrinology
- **Гинекология**: http://localhost:8080/gynecology
- **Неврология**: http://localhost:8080/neurology
- **Терапия**: http://localhost:8080/therapy

### 3. Остановка системы

```bash
# Остановка системы
npm run stop:telegram

# Или напрямую
./scripts/stop-telegram-to-rss.sh
```

## 📡 Интеграция с системой сбора контента

### 1. Добавление Telegram RSS-фидов

Обновите файл `config/rss-feeds.json`, добавив Telegram источники:

```json
{
  "id": "telegram_cardiology",
  "name": "Telegram Cardiology Channels",
  "url": "http://localhost:8080/cardiology",
  "level": "C",
  "specialization": "cardiology",
  "language": "ru",
  "enabled": true,
  "updateInterval": 300000,
  "tags": ["telegram", "cardiology", "social"]
}
```

### 2. Запуск сбора контента

```bash
# Сбор контента из всех источников (включая Telegram)
npm run collect

# Сбор только из Telegram каналов
node -e "
const ContentCollector = require('./src/collectors/content-collector');
const collector = new ContentCollector();
await collector.initialize(feedsConfig);
const telegramFeeds = feedsConfig.feeds.filter(f => f.tags.includes('telegram'));
const articles = await collector.collectAll({ feeds: telegramFeeds });
console.log('Собрано статей из Telegram:', articles.length);
"
```

## 🔍 Мониторинг и отладка

### 1. Просмотр логов

```bash
# Логи telegram-to-rss
tail -f logs/telegram-to-rss/app.log

# Логи Docker контейнеров
docker-compose -f docker-compose.telegram.yml logs -f
```

### 2. Проверка статуса контейнеров

```bash
# Статус контейнеров
docker-compose -f docker-compose.telegram.yml ps

# Проверка здоровья
docker-compose -f docker-compose.telegram.yml exec telegram-to-rss curl -f http://localhost:8080/health
```

### 3. Тестирование RSS-фидов

```bash
# Тест RSS-фида кардиологии
curl -s http://localhost:8080/cardiology | head -20

# Тест RSS-фида педиатрии
curl -s http://localhost:8080/pediatrics | head -20
```

## 🛠️ Устранение неполадок

### Частые проблемы

#### 1. Ошибка авторизации Telegram

```
Error: AUTH_KEY_UNREGISTERED
```

**Решение:**
- Проверьте правильность API_ID и API_HASH
- Убедитесь, что номер телефона указан в международном формате
- Пересоздайте session string

#### 2. Каналы не найдены

```
Error: CHANNEL_PRIVATE
```

**Решение:**
- Убедитесь, что каналы публичные
- Проверьте правильность имен каналов
- Некоторые каналы могут быть недоступны

#### 3. Docker контейнер не запускается

```
Error: Container failed to start
```

**Решение:**
- Проверьте, что Docker Desktop запущен
- Убедитесь, что порты 8080 и 1200 свободны
- Проверьте логи: `docker-compose -f docker-compose.telegram.yml logs`

### Логи отладки

```bash
# Включение подробных логов
export LOG_LEVEL=debug
npm run start:telegram
```

## 📈 Аналитика и метрики

### 1. Статистика по каналам

```bash
# Получение статистики
node -e "
const fs = require('fs');
const channels = JSON.parse(fs.readFileSync('config/telegram-channels.json', 'utf8'));
Object.entries(channels).forEach(([spec, chans]) => {
  console.log(\`\${spec}: \${chans.length} каналов\`);
});
"
```

### 2. Мониторинг активности

```bash
# Проверка последних постов
curl -s http://localhost:8080/cardiology | grep -o '<title>[^<]*</title>' | head -10
```

## 🔄 Обновление каналов

### 1. Добавление новых каналов

1. Отредактируйте `config/telegram-channels.json`
2. Добавьте новые каналы в соответствующие специальности
3. Перезапустите систему: `npm run stop:telegram && npm run start:telegram`

### 2. Удаление неактивных каналов

1. Отредактируйте `config/telegram-channels.json`
2. Удалите неактивные каналы
3. Перезапустите систему

## 📞 Поддержка

- **GitHub Issues**: [Создать issue](https://github.com/chashkinalex/medical-content-system/issues)
- **Email**: alex@kafedra.agency
- **Документация**: [README.md](README.md)

## ✅ Чек-лист настройки

- [ ] Docker Desktop установлен и запущен
- [ ] Docker Compose установлен
- [ ] Telegram API credentials получены
- [ ] Переменные окружения настроены в `.env.telegram`
- [ ] Session string получен
- [ ] Система запущена: `npm run start:telegram`
- [ ] RSS-фиды доступны в браузере
- [ ] Интеграция с системой сбора контента настроена

После выполнения всех пунктов система готова к мониторингу 111 Telegram каналов! 🎉
