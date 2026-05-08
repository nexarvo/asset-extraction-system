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

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg === null || arg === undefined) return '';
  if (typeof arg === 'object') {
    const entries = Object.entries(arg as Record<string, unknown>);
    if (entries.length === 0) return '';
    return entries
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ');
  }
  return String(arg);
}

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

    const extra = args.map(formatArg).filter(Boolean).join(' ');

    console.log(
      `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${COLORS.bright}${this.context}${COLORS.reset} ${message}${extra ? ' ' + extra : ''}`
    );
  }
}

export const createLogger = (context: string): ConsoleLogger => {
  return new ConsoleLogger(context);
};