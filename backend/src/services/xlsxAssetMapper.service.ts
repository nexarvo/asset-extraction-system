import { Injectable } from '@nestjs/common';
import { ExtractedAssetRecord, RawXlsxCellValue, RawXlsxRow } from '../utils/extraction.types';

@Injectable()
export class XlsxAssetMapperService {
  mapRow(row: RawXlsxRow): ExtractedAssetRecord {
    return row.headers.reduce<ExtractedAssetRecord>(
      (record, header, index) => {
        record[header] = this.normalizeValue(row.values[index]);
        return record;
      },
      { sheetName: row.sheetName },
    );
  }

  private normalizeValue(value: RawXlsxCellValue | undefined): string | number | boolean | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    return value;
  }
}
