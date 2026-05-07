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

export type ExtractedCellValue = string | number | boolean | null | unknown;

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
  readonly pdfDocument?: PdfDocument;
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

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'retrying';

export interface ExtractionJobData {
  readonly jobId: string;
  readonly filename: string;
  readonly buffer: Buffer | string;
  readonly fileType: 'csv' | 'xlsx' | 'pdf';
}

export interface ExtractionJobResult {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly filename: string;
  readonly fileType: 'csv' | 'xlsx' | 'pdf';
  readonly error?: string;
  readonly errorCode?: string;
  readonly stackTrace?: string;
}

export interface QueuedJobResponse {
  readonly jobId: string;
  readonly filename: string;
  readonly status: JobStatus;
}

export type TextBlockType = 'paragraph' | 'header' | 'table' | 'footer' | 'unknown';

export interface TextBlockPosition {
  readonly x: number;
  readonly y: number;
}

export interface TextBlock {
  readonly text: string;
  readonly type: TextBlockType;
  readonly pageNumber: number;
  readonly items: PdfTextItem[];
  readonly boundingBox?: {
    readonly xMin: number;
    readonly xMax: number;
    readonly yMin: number;
    readonly yMax: number;
  };
}

export interface PdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: number;
}

export interface PdfPage {
  readonly pageNumber: number;
  readonly items: PdfTextItem[];
  readonly textBlocks: TextBlock[];
}

export interface PdfDocument {
  readonly pages: PdfPage[];
}
