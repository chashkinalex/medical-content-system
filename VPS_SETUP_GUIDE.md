# 🖥️ Руководство по настройке VPS с премодерацией

## 🎯 Обзор системы

Система работает на VPS сервере с **ручной премодерацией** через Telegram бота. Это обеспечивает высокое качество контента при сохранении автоматизации.

## 🔄 Workflow премодерации

### **Еженедельная премодерация (воскресенье 10:00):**
1. **Бот отправляет посты** на премодерацию
2. **Модератор выбирает**: ✅ Да / ❌ Нет / 🔧 На доработку
3. **Одобренные посты** публикуются автоматически
4. **Отклоненные посты** заменяются новыми
5. **Посты на доработку** сохраняются для редактирования

### **Доработка (вторник и пятница):**
1. **Создаются файлы** для доработки в Cursor
2. **Модератор редактирует** посты вместе с AI
3. **Доработанные посты** отправляются на повторную премодерацию

## 🚀 Развертывание на VPS

### **1. Подготовка VPS сервера**

#### **Минимальные требования:**
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 50 GB SSD
- **ОС**: Ubuntu 20.04+ / CentOS 8+

#### **Рекомендуемые характеристики:**
- **CPU**: 4 ядра
- **RAM**: 8 GB
- **Диск**: 100 GB SSD
- **ОС**: Ubuntu 22.04 LTS

### **2. Развертывание системы**

```bash
# Клонирование репозитория
git clone https://github.com/chashkinalex/medical-content-system.git
cd medical-content-system

# Запуск скрипта развертывания
sudo ./scripts/deploy-vps.sh
```

### **3. Настройка домена и SSL**

```bash
# Редактирование конфигурации
nano /opt/medical-content-system/.env

# Настройка SSL сертификата
certbot --nginx -d your-domain.com
```

### **4. Настройка Telegram ботов**

#### **Создание бота для премодерации:**
1. Отправьте `/newbot` @BotFather
2. Выберите имя: `Medical Content Moderator`
3. Выберите username: `medical_moderator_bot`
4. Скопируйте токен

#### **Создание бота для публикации:**
1. Отправьте `/newbot` @BotFather
2. Выберите имя: `Medical Content Publisher`
3. Выберите username: `medical_publisher_bot`
4. Скопируйте токен

#### **Настройка каналов:**
1. Создайте каналы для каждой специальности
2. Добавьте бота публикации как администратора
3. Получите ID каналов

### **5. Конфигурация .env файла**

```bash
# Редактирование конфигурации
nano /opt/medical-content-system/.env
```

```env
# База данных
POSTGRES_PASSWORD=your_secure_password

# Telegram боты
MODERATION_BOT_TOKEN=your_moderation_bot_token
PUBLISHING_BOT_TOKEN=your_publishing_bot_token
MODERATOR_TELEGRAM_ID=your_telegram_id

# Каналы для публикации
CARDIOLOGY_CHANNEL_ID=@your_cardiology_channel
ENDOCRINOLOGY_CHANNEL_ID=@your_endocrinology_channel
PEDIATRICS_CHANNEL_ID=@your_pediatrics_channel
GASTROENTEROLOGY_CHANNEL_ID=@your_gastroenterology_channel
GYNECOLOGY_CHANNEL_ID=@your_gynecology_channel
NEUROLOGY_CHANNEL_ID=@your_neurology_channel
THERAPY_CHANNEL_ID=@your_therapy_channel

# Telegram API для telegram-to-rss
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=your_phone
TELEGRAM_SESSION_STRING=your_session_string

# Настройки приложения
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Настройки домена
DOMAIN=your-domain.com
EMAIL=your-email@example.com
```

## 🤖 Настройка Telegram ботов

### **1. Бот премодерации**

#### **Команды бота:**
- `/start` - Начать работу
- `/moderate` - Начать сессию премодерации
- `/status` - Статус очереди модерации
- `/help` - Помощь

#### **Workflow премодерации:**
```
🏥 ПОСТ НА ПРЕМОДЕРАЦИЮ

📋 Заголовок: Новое исследование по диабету
📚 Специальность: Эндокринология
⭐ Скоринг: 22/25
🔗 Источник: Diabetes Care

📝 Содержание:
[Полный текст поста]

❓ Публикуем пост?
✅ Да          ❌ Точно нет
🔧 На доработку
```

### **2. Бот публикации**

#### **Автоматическая публикация:**
- **8:00** - Исследования и гайдлайны
- **14:00** - Новости и обновления
- **20:00** - Практические советы

#### **Формат публикуемых постов:**
```
🔬 **Новое исследование по диабету 2 типа**

📋 **Суть:**
Краткое изложение исследования

🔍 **Ключевые моменты:**
• Пункт 1
• Пункт 2
• Пункт 3

💡 **Практическое применение:**
Как использовать в клинической практике

📚 **Источник:** Diabetes Care
🔗 **Ссылка:** [Читать полностью](URL)

🩺 #endocrinology #медицина #клиническаяпрактика
```

## 📅 Расписание работы

### **Ежедневно (автоматически):**
- **00:00** - Сбор контента из 111 источников
- **01:00** - Обработка и скоринг контента
- **02:00** - Генерация постов
- **03:00** - Отправка в очередь премодерации
- **8:00, 14:00, 20:00** - Публикация одобренных постов

### **Еженедельно (ручная премодерация):**
- **Воскресенье 10:00** - Сессия премодерации
- Модератор просматривает 35+ постов
- Принимает решения: Да/Нет/На доработку

### **Каждые 3 дня (доработка):**
- **Вторник, Пятница** - Сессии доработки
- Модератор работает с постами "На доработку"
- Использует Cursor для редактирования

## 🔧 Управление системой

### **Основные команды:**

```bash
# Управление системой
/opt/medical-content-system/manage.sh start      # Запуск
/opt/medical-content-system/manage.sh stop       # Остановка
/opt/medical-content-system/manage.sh restart    # Перезапуск
/opt/medical-content-system/manage.sh status     # Статус
/opt/medical-content-system/manage.sh logs       # Логи
/opt/medical-content-system/manage.sh update     # Обновление
/opt/medical-content-system/manage.sh backup     # Резервная копия
```

### **Мониторинг:**

```bash
# Проверка статуса контейнеров
docker-compose -f docker-compose.vps.yml ps

# Просмотр логов
docker-compose -f docker-compose.vps.yml logs -f

# Мониторинг ресурсов
htop
df -h
free -h
```

### **Веб-интерфейсы:**
- **Основное приложение**: http://your-domain.com
- **Мониторинг**: http://your-domain.com:9090
- **База данных**: localhost:5432

## 📝 Работа с доработкой постов

### **1. Создание файлов для доработки**

```bash
# Создание файлов для доработки
node scripts/revision-queue.js create
```

### **2. Структура файла доработки**

```markdown
# Доработка поста 123

## 📋 Информация о посте
- **ID:** 123
- **Заголовок:** Новое исследование по диабету
- **Специальность:** endocrinology
- **Тип:** research
- **Скоринг:** 22/25

## 📝 Оригинальное содержание
[Оригинальный текст поста]

## 🔧 Задачи для доработки
- [ ] Проверить медицинскую точность
- [ ] Улучшить структуру поста
- [ ] Добавить практические рекомендации

## ✏️ Доработанное содержание
<!-- Внесите изменения здесь -->

## ✅ Чек-лист перед отправкой
- [ ] Медицинская информация проверена
- [ ] Пост соответствует формату канала
- [ ] Добавлены практические рекомендации
```

### **3. Обработка доработанных постов**

```bash
# Обработка доработанных постов
node scripts/revision-queue.js process
```

## 🎯 Преимущества системы

### **Качество контента:**
- ✅ **100% контроль качества** через ручную премодерацию
- ✅ **Медицинская точность** проверяется экспертом
- ✅ **Соответствие стандартам** канала
- ✅ **Адаптация под аудиторию** по результатам обратной связи

### **Эффективность:**
- ✅ **90% автоматизации** сбора и обработки
- ✅ **Гибкость** в принятии решений
- ✅ **Масштабируемость** системы
- ✅ **Отслеживаемость** всех решений

### **Удобство:**
- ✅ **Еженедельная сессия** премодерации (1-2 часа)
- ✅ **Доработка в Cursor** каждые 3 дня
- ✅ **Автоматическая публикация** одобренных постов
- ✅ **Уведомления** о статусе постов

## 🚨 Устранение неполадок

### **Проблемы с ботом:**
```bash
# Проверка токенов
grep -E "BOT_TOKEN|CHANNEL_ID" .env

# Перезапуск ботов
docker-compose -f docker-compose.vps.yml restart moderation-bot
docker-compose -f docker-compose.vps.yml restart publishing-bot
```

### **Проблемы с базой данных:**
```bash
# Проверка подключения
docker-compose -f docker-compose.vps.yml exec database psql -U postgres -d medical_content -c "SELECT COUNT(*) FROM posts;"

# Резервное копирование
docker-compose -f docker-compose.vps.yml exec database pg_dump -U postgres medical_content > backup.sql
```

### **Проблемы с производительностью:**
```bash
# Мониторинг ресурсов
docker stats

# Очистка логов
docker system prune -f
```

## 📞 Поддержка

### **Логи системы:**
```bash
# Просмотр логов
tail -f /opt/medical-content-system/logs/app.log
tail -f /opt/medical-content-system/logs/moderation.log
tail -f /opt/medical-content-system/logs/publishing.log
```

### **Мониторинг:**
- **Статус системы**: `/opt/medical-content-system/manage.sh status`
- **Логи в реальном времени**: `/opt/medical-content-system/manage.sh logs`
- **Метрики**: http://your-domain.com:9090

Эта система обеспечит **высокое качество медицинского контента** при **максимальной автоматизации** процессов! 🏥✨
