import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

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

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write('INFO', message, context, metadata);
  }

  error(message: string, trace?: string, context?: string, metadata?: Record<string, unknown>): void {
    const meta = trace ? { ...metadata, trace } : metadata;
    this.write('ERROR', message, context, meta);
  }

  warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write('WARN', message, context, metadata);
  }

  debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write('INFO', message, context, metadata);
  }

  verbose(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write('INFO', message, context, metadata);
  }

  private write(level: LogLevel, message: string, context?: string, metadata?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const ctx = context || 'App';
    const metaStr = formatMetadata(metadata);
    const extra = metaStr ? ` ${metaStr}` : '';

    const output = `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${COLORS.bright}${ctx}${COLORS.reset} ${message}${extra}`;

    if (level === 'ERROR') {
      process.stderr.write(`${output}\n`);
      return;
    }

    process.stdout.write(`${output}\n`);
  }
}