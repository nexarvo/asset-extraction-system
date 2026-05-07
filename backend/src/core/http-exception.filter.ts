import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { ERROR_MESSAGE_MAP } from '../error-codes/error-mapping';
import { AppLoggerService } from './app-logger.service';

interface StandardErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly path: string;
  readonly timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = this.getStatus(exception);
    const body = this.createResponse(exception, request.url);

    this.logger.error(
      body.error.message,
      exception instanceof Error ? exception.stack : undefined,
      'HttpExceptionFilter',
      {
        code: body.error.code,
        path: request.url,
        method: request.method,
        status,
      },
    );

    response.status(status).json(body);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof ApplicationError) {
      return exception.statusCode;
    }

    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private createResponse(
    exception: unknown,
    path: string,
  ): StandardErrorResponse {
    if (exception instanceof ApplicationError) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        path,
        timestamp: new Date().toISOString(),
      };
    }

    if (exception instanceof HttpException) {
      return {
        success: false,
        error: {
          code: ErrorCode.ValidationFailed,
          message: exception.message,
          details: exception.getResponse(),
        },
        path,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      error: {
        code: ErrorCode.InternalError,
        message: ERROR_MESSAGE_MAP[ErrorCode.InternalError],
      },
      path,
      timestamp: new Date().toISOString(),
    };
  }
}
