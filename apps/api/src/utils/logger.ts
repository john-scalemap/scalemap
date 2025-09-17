export interface LogContext {
  requestId?: string;
  userId?: string;
  companyId?: string;
  functionName?: string;
  [key: string]: unknown;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context: this.context,
      ...meta,
    };
    return JSON.stringify(logEntry);
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatMessage('INFO', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.formatMessage('ERROR', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }

  child(additionalContext: LogContext) {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

export const logger = new Logger({
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'local',
});