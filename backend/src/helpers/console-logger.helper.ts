export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const enableColors = process.env.FORCE_COLOR === '1' || 
                     process.env.FORCE_COLOR === 'true' ||
                     !process.env.NO_COLOR;

const COLORS = enableColors ? {
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
} : {
  reset: '',
  bright: '',
  dim: '',
  red: '',
  green: '',
  yellow: '',
  blue: '',
  magenta: '',
  cyan: '',
  white: '',
  gray: '',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: COLORS.cyan,
  WARN: COLORS.yellow,
  ERROR: COLORS.red,
};

function formatMetadata(meta?: Record<string, unknown>): string {
  if (!meta) return '';
  
  const entries = Object.entries(meta).filter(([_, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  
  return entries
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${String(value)}`;
    })
    .join(' ');
}

export class ConsoleLogger {
  constructor(private context: string = 'App') {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('ERROR', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const metaStr = formatMetadata(meta);
    const extra = metaStr ? ` ${metaStr}` : '';

    console.log(
      `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${COLORS.bright}${this.context}${COLORS.reset} ${message}${extra}`
    );
  }
}

export const createLogger = (context: string): ConsoleLogger => {
  return new ConsoleLogger(context);
};