/**
 * Sicoob Logger Service
 * Structured logging with sensitive data masking
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class SicoobLogger {
  private logFile: string;
  private minLevel: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(service: string = 'sicoob', minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFile = path.join(
      logsDir,
      `sicoob-${new Date().toISOString().split('T')[0]}.log`
    );
  }

  private maskSensitiveData(data: any, seen: WeakSet<object> = new WeakSet()): any {
    if (!data) return data;

    const sensitiveKeys = [
      'access_token',
      'token',
      'secret',
      'password',
      'cpf',
      'cnpj',
      'chave_pix',
      'cartao',
      'numero_conta',
      'agencia',
    ];

    if (typeof data === 'string') {
      return data.replace(/[\d]{4}(?=[\d]{2})/g, '****');
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item, seen));
    }

    if (typeof data === 'object') {
      if (seen.has(data)) {
        return '[Circular]';
      }
      seen.add(data);
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = this.maskSensitiveData(value, seen);
        }
      }
      return masked;
    }

    return data;
  }

  private formatLog(entry: LogEntry): string {
    const maskedContext = entry.context
      ? this.maskSensitiveData(entry.context)
      : null;
    return JSON.stringify({
      ...entry,
      context: maskedContext,
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private write(entry: LogEntry): void {
    const formatted = this.formatLog(entry);
    fs.appendFileSync(this.logFile, formatted + '\n', 'utf8');
  }

  debug(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('debug')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'sicoob',
      message,
      context,
    };
    console.debug('[SICOOB DEBUG]', message, context);
    this.write(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('info')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'sicoob',
      message,
      context,
    };
    console.info('[SICOOB INFO]', message, context);
    this.write(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    if (!this.shouldLog('warn')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'sicoob',
      message,
      context,
    };
    console.warn('[SICOOB WARN]', message, context);
    this.write(entry);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    if (!this.shouldLog('error')) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'sicoob',
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    console.error('[SICOOB ERROR]', message, error, context);
    this.write(entry);
  }
}

export const sicoobLogger = new SicoobLogger('sicoob', 'debug');
