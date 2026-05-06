import { ErrorCode } from './error-codes';
import { ERROR_MESSAGE_MAP, ERROR_STATUS_MAP } from './error-mapping';

export class ApplicationError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message = ERROR_MESSAGE_MAP[code], details?: unknown) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = ERROR_STATUS_MAP[code];
    this.details = details;
  }
}
