import { Injectable } from '@nestjs/common';
import { ExtractedAssetRecord, RawCsvRow } from '../utils/extraction.types';

@Injectable()
export class CsvAssetMapperService {
  mapRow(row: RawCsvRow): ExtractedAssetRecord {
    return row.headers.reduce<ExtractedAssetRecord>((record, header, index) => {
      record[header] = this.normalizeValue(row.values[index]);
      return record;
    }, {});
  }

  private normalizeValue(value: string | undefined): string | null {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }
}
