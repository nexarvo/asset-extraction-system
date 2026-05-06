import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

interface StructuredLog {
  readonly level: LogLevel;
  readonly timestamp: string;
  readonly message: string;
  readonly context?: string;
  readonly trace?: string;
  readonly metadata?: Record<string, unknown>;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  log(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write({ level: 'log', message, context, metadata });
  }

  error(message: string, trace?: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write({ level: 'error', message, trace, context, metadata });
  }

  warn(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write({ level: 'warn', message, context, metadata });
  }

  debug(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write({ level: 'debug', message, context, metadata });
  }

  verbose(message: string, context?: string, metadata?: Record<string, unknown>): void {
    this.write({ level: 'verbose', message, context, metadata });
  }

  private write(entry: Omit<StructuredLog, 'timestamp'>): void {
    const payload: StructuredLog = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    const serialized = JSON.stringify(payload);

    if (entry.level === 'error') {
      process.stderr.write(`${serialized}\n`);
      return;
    }

    process.stdout.write(`${serialized}\n`);
  }
}
