const winston = require('winston');
const path = require('path');

/**
 * Логгер для Medical Content System
 */
class Logger {
    constructor() {
        this.logger = this.createLogger();
    }

    /**
     * Создание конфигурации логгера
     */
    createLogger() {
        const logFormat = winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
                
                if (Object.keys(meta).length > 0) {
                    log += ` ${JSON.stringify(meta)}`;
                }
                
                if (stack) {
                    log += `\n${stack}`;
                }
                
                return log;
            })
        );

        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
                format: 'HH:mm:ss'
            }),
            winston.format.printf(({ timestamp, level, message, stack }) => {
                let log = `${timestamp} ${level} ${message}`;
                if (stack) {
                    log += `\n${stack}`;
                }
                return log;
            })
        );

        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            defaultMeta: { service: 'medical-content-system' },
            transports: [
                // Консольный вывод
                new winston.transports.Console({
                    format: consoleFormat
                }),
                
                // Файловый вывод для всех логов
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/system.log'),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                    format: logFormat
                }),
                
                // Файловый вывод только для ошибок
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/error.log'),
                    level: 'error',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                    format: logFormat
                })
            ],
            exceptionHandlers: [
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/exceptions.log')
                })
            ],
            rejectionHandlers: [
                new winston.transports.File({
                    filename: path.join(__dirname, '../../logs/rejections.log')
                })
            ]
        });
    }

    /**
     * Логирование информации
     */
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    /**
     * Логирование предупреждений
     */
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    /**
     * Логирование ошибок
     */
    error(message, error = null, meta = {}) {
        if (error instanceof Error) {
            this.logger.error(message, { 
                error: error.message, 
                stack: error.stack,
                ...meta 
            });
        } else {
            this.logger.error(message, { error, ...meta });
        }
    }

    /**
     * Логирование отладочной информации
     */
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    /**
     * Логирование успешных операций
     */
    success(message, meta = {}) {
        this.logger.info(`✅ ${message}`, meta);
    }

    /**
     * Логирование начала операции
     */
    start(message, meta = {}) {
        this.logger.info(`🚀 ${message}`, meta);
    }

    /**
     * Логирование завершения операции
     */
    complete(message, meta = {}) {
        this.logger.info(`✅ ${message}`, meta);
    }

    /**
     * Логирование с прогрессом
     */
    progress(current, total, message, meta = {}) {
        const percentage = Math.round((current / total) * 100);
        this.logger.info(`📊 ${message} (${current}/${total} - ${percentage}%)`, meta);
    }

    /**
     * Логирование статистики
     */
    stats(stats, meta = {}) {
        this.logger.info('📈 Статистика:', { stats, ...meta });
    }

    /**
     * Логирование контента
     */
    content(type, data, meta = {}) {
        this.logger.info(`📝 ${type}:`, { data, ...meta });
    }

    /**
     * Логирование API запросов
     */
    api(method, url, status, duration, meta = {}) {
        this.logger.info(`🌐 ${method} ${url} - ${status} (${duration}ms)`, meta);
    }

    /**
     * Логирование базы данных
     */
    database(operation, table, duration, meta = {}) {
        this.logger.info(`🗄️ ${operation} ${table} (${duration}ms)`, meta);
    }

    /**
     * Логирование Telegram
     */
    telegram(action, channel, result, meta = {}) {
        this.logger.info(`📱 Telegram ${action} ${channel}: ${result}`, meta);
    }

    /**
     * Логирование RSS
     */
    rss(feed, articles, meta = {}) {
        this.logger.info(`📡 RSS ${feed}: ${articles} статей`, meta);
    }

    /**
     * Логирование скоринга
     */
    scoring(article, score, meta = {}) {
        this.logger.info(`📊 Скоринг: ${score}/${this.getMaxScore()} - ${article}`, meta);
    }

    /**
     * Получение максимального балла скоринга
     */
    getMaxScore() {
        return parseInt(process.env.SCORING_MAX) || 25;
    }

    /**
     * Создание дочернего логгера
     */
    child(defaultMeta) {
        return this.logger.child(defaultMeta);
    }

    /**
     * Получение базового логгера Winston
     */
    getWinstonLogger() {
        return this.logger;
    }
}

module.exports = Logger;
