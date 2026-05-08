export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: COLORS.cyan,
  WARN: COLORS.yellow,
  ERROR: COLORS.red,
};

export class ConsoleLogger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('ERROR', message, args);
  }

  private log(level: LogLevel, message: string, args: unknown[] = []): void {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];

    let extra = '';
    for (const arg of args) {
      if (typeof arg === 'string') {
        extra += ` ${arg}`;
      } else if (arg && typeof arg === 'object') {
        extra += ` ${JSON.stringify(arg)}`;
      }
    }

    console.log(
      `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${COLORS.bright}${this.context}${COLORS.reset} ${message}${extra}`
    );
  }
}

export const createLogger = (context: string): ConsoleLogger => {
  return new ConsoleLogger(context);
};