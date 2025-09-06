#!/bin/bash

# 🚀 Скрипт развертывания медицинской системы на VPS
# Автор: Medical Content System
# Версия: 1.0

set -e

echo "🏥 Развертывание Medical Content System на VPS"
echo "=============================================="

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Запустите скрипт с правами root: sudo ./deploy-vps.sh"
    exit 1
fi

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка необходимых пакетов
echo "🔧 Установка зависимостей..."
apt install -y curl wget git nginx certbot python3-certbot-nginx

# Установка Docker
echo "🐳 Установка Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Установка Docker Compose
echo "🐙 Установка Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Создание пользователя для приложения
echo "👤 Создание пользователя приложения..."
useradd -m -s /bin/bash medical-content || true
usermod -aG docker medical-content

# Создание директорий
echo "📁 Создание директорий..."
mkdir -p /opt/medical-content-system/{data,logs,config,ssl,monitoring}
chown -R medical-content:medical-content /opt/medical-content-system

# Копирование файлов проекта
echo "📋 Копирование файлов проекта..."
cp -r . /opt/medical-content-system/
chown -R medical-content:medical-content /opt/medical-content-system

# Создание .env файла
echo "⚙️ Создание конфигурации..."
cat > /opt/medical-content-system/.env << EOF
# База данных
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Telegram боты
MODERATION_BOT_TOKEN=your_moderation_bot_token_here
PUBLISHING_BOT_TOKEN=your_publishing_bot_token_here

# Telegram API для telegram-to-rss
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=your_phone_here
TELEGRAM_SESSION_STRING=your_session_string_here

# Настройки приложения
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Настройки домена
DOMAIN=your-domain.com
EMAIL=your-email@example.com
EOF

# Настройка Nginx
echo "🌐 Настройка Nginx..."
cat > /etc/nginx/sites-available/medical-content << EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/medical-content /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Настройка SSL сертификата
echo "🔒 Настройка SSL..."
echo "⚠️  ВАЖНО: Настройте домен и запустите:"
echo "   certbot --nginx -d your-domain.com"
echo "   certbot --nginx -d your-domain.com --email your-email@example.com --agree-tos --non-interactive"

# Создание systemd сервиса
echo "🔧 Создание systemd сервиса..."
cat > /etc/systemd/system/medical-content.service << EOF
[Unit]
Description=Medical Content System
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/medical-content-system
ExecStart=/usr/local/bin/docker-compose -f docker-compose.vps.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.vps.yml down
TimeoutStartSec=0
User=medical-content
Group=medical-content

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable medical-content

# Создание cron задач
echo "⏰ Настройка cron задач..."
cat > /etc/cron.d/medical-content << EOF
# Сбор контента каждый час
0 * * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/collect.js

# Обработка контента каждые 4 часа
0 */4 * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/process.js

# Скоринг контента каждые 6 часов
0 */6 * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/score.js

# Генерация постов каждые 8 часов
0 */8 * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/generate.js

# Премодерация каждое воскресенье в 10:00
0 10 * * 0 medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/send-for-moderation.js

# Публикация одобренных постов по расписанию
0 8,14,20 * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/publish-approved.js

# Мониторинг каждые 15 минут
*/15 * * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/monitor.js

# Аналитика ежедневно в 23:00
0 23 * * * medical-content cd /opt/medical-content-system && docker-compose -f docker-compose.vps.yml exec -T app node scripts/analytics.js
EOF

# Создание скрипта управления
echo "🛠️ Создание скриптов управления..."
cat > /opt/medical-content-system/manage.sh << 'EOF'
#!/bin/bash

case "$1" in
    start)
        echo "🚀 Запуск Medical Content System..."
        systemctl start medical-content
        ;;
    stop)
        echo "🛑 Остановка Medical Content System..."
        systemctl stop medical-content
        ;;
    restart)
        echo "🔄 Перезапуск Medical Content System..."
        systemctl restart medical-content
        ;;
    status)
        echo "📊 Статус Medical Content System..."
        systemctl status medical-content
        docker-compose -f docker-compose.vps.yml ps
        ;;
    logs)
        echo "📋 Логи Medical Content System..."
        docker-compose -f docker-compose.vps.yml logs -f
        ;;
    update)
        echo "🔄 Обновление Medical Content System..."
        cd /opt/medical-content-system
        git pull origin main
        docker-compose -f docker-compose.vps.yml build
        systemctl restart medical-content
        ;;
    backup)
        echo "💾 Создание резервной копии..."
        docker-compose -f docker-compose.vps.yml exec database pg_dump -U postgres medical_content > backup_$(date +%Y%m%d_%H%M%S).sql
        ;;
    *)
        echo "Использование: $0 {start|stop|restart|status|logs|update|backup}"
        exit 1
        ;;
esac
EOF

chmod +x /opt/medical-content-system/manage.sh
chown medical-content:medical-content /opt/medical-content-system/manage.sh

# Создание скрипта настройки Telegram ботов
echo "🤖 Создание скрипта настройки Telegram ботов..."
cat > /opt/medical-content-system/setup-telegram-bots.sh << 'EOF'
#!/bin/bash

echo "🤖 Настройка Telegram ботов для премодерации"
echo "============================================="

echo "📋 Инструкции по настройке:"
echo ""
echo "1. Создайте бота для премодерации:"
echo "   - Отправьте /newbot @BotFather"
echo "   - Выберите имя: Medical Content Moderator"
echo "   - Выберите username: medical_moderator_bot"
echo "   - Скопируйте токен"
echo ""
echo "2. Создайте бота для публикации:"
echo "   - Отправьте /newbot @BotFather"
echo "   - Выберите имя: Medical Content Publisher"
echo "   - Выберите username: medical_publisher_bot"
echo "   - Скопируйте токен"
echo ""
echo "3. Отредактируйте .env файл:"
echo "   nano /opt/medical-content-system/.env"
echo ""
echo "4. Замените токены в файле:"
echo "   MODERATION_BOT_TOKEN=ваш_токен_модерации"
echo "   PUBLISHING_BOT_TOKEN=ваш_токен_публикации"
echo ""
echo "5. Перезапустите систему:"
echo "   /opt/medical-content-system/manage.sh restart"
echo ""
echo "6. Проверьте статус:"
echo "   /opt/medical-content-system/manage.sh status"
EOF

chmod +x /opt/medical-content-system/setup-telegram-bots.sh
chown medical-content:medical-content /opt/medical-content-system/setup-telegram-bots.sh

echo ""
echo "🎉 Развертывание завершено!"
echo "=========================="
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте домен в .env файле:"
echo "   nano /opt/medical-content-system/.env"
echo ""
echo "2. Настройте SSL сертификат:"
echo "   certbot --nginx -d your-domain.com"
echo ""
echo "3. Настройте Telegram ботов:"
echo "   /opt/medical-content-system/setup-telegram-bots.sh"
echo ""
echo "4. Запустите систему:"
echo "   /opt/medical-content-system/manage.sh start"
echo ""
echo "5. Проверьте статус:"
echo "   /opt/medical-content-system/manage.sh status"
echo ""
echo "📚 Управление системой:"
echo "   start    - Запуск системы"
echo "   stop     - Остановка системы"
echo "   restart  - Перезапуск системы"
echo "   status   - Статус системы"
echo "   logs     - Просмотр логов"
echo "   update   - Обновление системы"
echo "   backup   - Резервное копирование"
echo ""
echo "🔗 Веб-интерфейс: http://your-domain.com"
echo "📊 Мониторинг: http://your-domain.com:9090"
echo ""
echo "✅ Система готова к работе!"
