import { AssetFileInput, SupportedFileType } from './extraction.types';

export function getFileExtension(filename: string): string {
  const extension = filename.split('.').pop();
  return extension?.toLowerCase() ?? '';
}

export function getSupportedFileType(input: AssetFileInput): SupportedFileType {
  const extension = getFileExtension(input.filename);

  if (extension === SupportedFileType.Csv) {
    return SupportedFileType.Csv;
  }

  if (extension === SupportedFileType.Xls) {
    return SupportedFileType.Xls;
  }

  if (extension === SupportedFileType.Xlsx) {
    return SupportedFileType.Xlsx;
  }

  if (extension === SupportedFileType.Pdf) {
    return SupportedFileType.Pdf;
  }

  throw new Error(`Unsupported file extension: ${extension}`);
}

export function createExtractionMetadata(
  rowCount: number,
  warnings: string[] = [],
) {
  return {
    rowCount,
    warnings,
    extractedAt: new Date().toISOString(),
  };
}
