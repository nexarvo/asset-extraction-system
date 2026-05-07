import { Injectable } from '@nestjs/common';
import { ParsedXlsxRow, ExtractedAssetCandidate, ExtractedFieldCandidate } from '../utils/csv-stream.types';

@Injectable()
export class XlsxAssetMapperService {
  private fieldMapping: Record<string, string> = {
    asset_name: 'asset_name',
    name: 'asset_name',
    assetname: 'asset_name',
    asset_value: 'asset_value',
    value: 'asset_value',
    assetvalue: 'asset_value',
    currency: 'currency',
    asset_type: 'asset_type',
    type: 'asset_type',
    assettype: 'asset_type',
    location: 'location',
    address: 'location',
    jurisdiction: 'jurisdiction',
    country: 'jurisdiction',
    latitude: 'latitude',
    lat: 'latitude',
    longitude: 'longitude',
    lng: 'longitude',
    lon: 'longitude',
    description: 'description',
    notes: 'description',
    owner: 'owner',
    operator: 'operator',
    capacity: 'capacity',
    status: 'status',
  };

  mapRow(parsedRow: ParsedXlsxRow): ExtractedAssetCandidate {
    const fields: ExtractedFieldCandidate[] = [];
    let rawAssetName: string | undefined;

    for (const [columnName, value] of Object.entries(parsedRow.data)) {
      const mappedFieldName = this.fieldMapping[columnName] || columnName;

      if (mappedFieldName === 'asset_name' && value !== null) {
        rawAssetName = String(value);
      }

      const fieldCandidate: ExtractedFieldCandidate = {
        fieldName: mappedFieldName,
        rawValue: value !== null ? String(value) : null,
        normalizedValue: this.normalizeValue(mappedFieldName, value),
        confidenceScore: this.calculateConfidence(mappedFieldName, value),
        sourceColumn: columnName,
      };

      fields.push(fieldCandidate);
    }

    return {
      rawAssetName,
      fields,
      sourceRowIndex: parsedRow.rowIndex,
      sourceSheetName: parsedRow.sheetName,
      overallConfidence: this.calculateOverallConfidence(fields),
    };
  }

  mapRows(parsedRows: ParsedXlsxRow[]): ExtractedAssetCandidate[] {
    return parsedRows.map((row) => this.mapRow(row));
  }

  private normalizeValue(fieldName: string, value: string | number | null): unknown {
    if (value === null) return null;

    switch (fieldName) {
      case 'latitude':
      case 'lat': {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(num) ? null : num;
      }
      case 'longitude':
      case 'lng':
      case 'lon': {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        return isNaN(num) ? null : num;
      }
      case 'asset_value':
      case 'value':
      case 'capacity': {
        const strValue = typeof value === 'number' ? String(value) : String(value);
        const cleaned = strValue.replace(/[,$]/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      }
      default:
        return typeof value === 'string' ? value.trim() : String(value);
    }
  }

  private calculateConfidence(fieldName: string, value: string | number | null): number {
    if (value === null || value === '') return 0;

    switch (fieldName) {
      case 'asset_name':
        return value !== null ? 0.9 : 0;
      case 'latitude':
      case 'longitude': {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(num)) return 0.3;
        if (fieldName === 'latitude' && (num < -90 || num > 90)) return 0.3;
        if (fieldName === 'longitude' && (num < -180 || num > 180)) return 0.3;
        return 0.85;
      }
      case 'currency':
        const strVal = String(value);
        return /^[A-Z]{3}$/.test(strVal) ? 0.95 : 0.5;
      default:
        return 0.7;
    }
  }

  private calculateOverallConfidence(fields: ExtractedFieldCandidate[]): number {
    const nonNullFields = fields.filter((f) => f.rawValue !== null);
    if (nonNullFields.length === 0) return 0;

    const totalConfidence = nonNullFields.reduce((sum, f) => sum + (f.confidenceScore || 0), 0);
    return totalConfidence / nonNullFields.length;
  }
}