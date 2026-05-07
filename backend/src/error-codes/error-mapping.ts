import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export const ERROR_STATUS_MAP: Record<ErrorCode, HttpStatus> = {
  [ErrorCode.UnsupportedFileType]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CsvExtractionFailed]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CsvRowInvalid]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CsvStreamFailure]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.XlsxExtractionFailed]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.XlsxRowInvalid]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.XlsxWorkbookFailure]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PdfExtractionFailed]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.OcrExtractionFailed]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.ValidationFailed]: HttpStatus.BAD_REQUEST,
  [ErrorCode.PersistenceFailed]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.InternalError]: HttpStatus.INTERNAL_SERVER_ERROR,
};

export const ERROR_MESSAGE_MAP: Record<ErrorCode, string> = {
  [ErrorCode.UnsupportedFileType]: 'The uploaded file type is not supported.',
  [ErrorCode.CsvExtractionFailed]: 'CSV extraction failed.',
  [ErrorCode.CsvRowInvalid]: 'CSV row validation failed.',
  [ErrorCode.CsvStreamFailure]: 'CSV stream processing failed.',
  [ErrorCode.XlsxExtractionFailed]: 'Spreadsheet extraction failed.',
  [ErrorCode.XlsxRowInvalid]: 'Spreadsheet row validation failed.',
  [ErrorCode.XlsxWorkbookFailure]: 'Spreadsheet workbook processing failed.',
  [ErrorCode.PdfExtractionFailed]: 'PDF extraction failed.',
  [ErrorCode.OcrExtractionFailed]: 'OCR extraction failed.',
  [ErrorCode.ValidationFailed]: 'Request validation failed.',
  [ErrorCode.PersistenceFailed]: 'Could not persist extraction result.',
  [ErrorCode.InternalError]: 'An unexpected error occurred.',
};
