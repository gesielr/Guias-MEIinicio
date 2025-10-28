import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Configuração do formato de log estruturado
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Logger estruturado para o sistema NFSe
 * - Rotação diária de arquivos
 * - Separação de logs de erro e combinados
 * - Console colorido em desenvolvimento
 */
const logger = winston.createLogger({
  format: logFormat,
  transports: [
    // Arquivo de erros
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    // Arquivo combinado
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// Console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
