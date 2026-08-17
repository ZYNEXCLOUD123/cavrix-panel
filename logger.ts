export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVELS: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LogLevel.INFO;

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return level >= currentLevel;
}

export const logger = {
  debug(message: string, ...args: any[]) {
    if (shouldLog(LogLevel.DEBUG)) {
      console.log(`[${formatTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  },

  info(message: string, ...args: any[]) {
    if (shouldLog(LogLevel.INFO)) {
      console.log(`[${formatTimestamp()}] [INFO] ${message}`, ...args);
    }
  },

  warn(message: string, ...args: any[]) {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(`[${formatTimestamp()}] [WARN] ${message}`, ...args);
    }
  },

  error(message: string, ...args: any[]) {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(`[${formatTimestamp()}] [ERROR] ${message}`, ...args);
    }
  },
};
