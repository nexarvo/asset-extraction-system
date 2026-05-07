export enum ErrorCode {
  UnsupportedFileType = 'UNSUPPORTED_FILE_TYPE',
  CsvExtractionFailed = 'CSV_EXTRACTION_FAILED',
  CsvRowInvalid = 'CSV_ROW_INVALID',
  CsvStreamFailure = 'CSV_STREAM_FAILURE',
  XlsxExtractionFailed = 'XLSX_EXTRACTION_FAILED',
  PdfExtractionFailed = 'PDF_EXTRACTION_FAILED',
  OcrExtractionFailed = 'OCR_EXTRACTION_FAILED',
  ValidationFailed = 'VALIDATION_FAILED',
  PersistenceFailed = 'PERSISTENCE_FAILED',
  InternalError = 'INTERNAL_ERROR',
}
