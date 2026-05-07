export enum SupportedFileType {
  Csv = 'csv',
  Xls = 'xls',
  Xlsx = 'xlsx',
  Pdf = 'pdf',
}

export enum PdfExtractionStrategy {
  Digital = 'digital',
  Scanned = 'scanned',
}

export type ExtractedCellValue = string | number | boolean | null;

export type ExtractedAssetRecord = Record<string, ExtractedCellValue>;

export interface RawCsvRow {
  readonly headers: string[];
  readonly values: string[];
  readonly rowIndex: number;
  readonly extraValues: string[];
  readonly raw: Record<string, string>;
}

export type RawXlsxCellValue = string | number | boolean | Date | null;

export interface RawXlsxRow {
  readonly sheetName: string;
  readonly rowIndex: number;
  readonly headers: string[];
  readonly values: RawXlsxCellValue[];
  readonly extraValues: RawXlsxCellValue[];
}

export interface AssetFileInput {
  readonly filename: string;
  readonly buffer: Buffer;
  readonly mimeType?: string;
}

export interface ExtractionResult {
  readonly sourceFile: string;
  readonly fileType: SupportedFileType;
  readonly records: ExtractedAssetRecord[];
  readonly text?: string;
  readonly strategy?: PdfExtractionStrategy;
  readonly metadata: ExtractionMetadata;
}

export interface ExtractionMetadata {
  readonly rowCount: number;
  readonly extractedAt: string;
  readonly warnings: string[];
}

export interface OcrResult {
  readonly text: string;
  readonly confidence: number;
  readonly engine: 'paddleocr';
}

export interface StoredExtraction {
  readonly id: string;
  readonly result: ExtractionResult;
  readonly createdAt: string;
}
