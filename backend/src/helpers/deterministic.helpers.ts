export interface ParsedCoordinate {
  value: number | null;
  valid: boolean;
  parsed: boolean;
}

export interface ParsedCurrency {
  value: string | null;
  valid: boolean;
}

export interface ParsedNumeric {
  value: number | null;
  valid: boolean;
  parsed: boolean;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'BRL',
  'MXN', 'SGD', 'HKD', 'KRW', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'RUB',
  'IDR', 'MYR', 'PHP', 'THB', 'VND', 'AED', 'SAR', 'ILS', 'TRY',
]);

const CANONICAL_MAPPINGS: Record<string, string[]> = {
  assetName: ['asset', 'name', 'property', 'facility', 'building', 'assetname'],
  value: ['value', 'amount', 'price', 'valuation', 'cost', 'total_value', 'market_value'],
  currency: ['currency', 'curr'],
  jurisdiction: ['location', 'country', 'state', 'province', 'region', 'city', 'address'],
  latitude: ['lat', 'latitude', 'lat_deg'],
  longitude: ['lng', 'lon', 'long', 'longitude', 'lng_deg'],
  assetType: ['type', 'category', 'classification', 'property_type', 'kind', 'subtype'],
};

export class DeterministicHelpers {
  static parseLatitude(value: unknown): ParsedCoordinate {
    if (value === null || value === undefined || value === '') {
      return { value: null, valid: false, parsed: false };
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(num) || !isFinite(num)) {
      return { value: null, valid: false, parsed: false };
    }

    const valid = num >= -90 && num <= 90;
    return { value: num, valid, parsed: true };
  }

  static parseLongitude(value: unknown): ParsedCoordinate {
    if (value === null || value === undefined || value === '') {
      return { value: null, valid: false, parsed: false };
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(num) || !isFinite(num)) {
      return { value: null, valid: false, parsed: false };
    }

    const valid = num >= -180 && num <= 180;
    return { value: num, valid, parsed: true };
  }

  static normalizeCurrency(value: unknown): ParsedCurrency {
    if (!value) {
      return { value: null, valid: false };
    }

    const strValue = String(value).trim().toUpperCase();

    if (strValue.length !== 3) {
      return { value: null, valid: false };
    }

    const valid = VALID_CURRENCIES.has(strValue);
    return { value: valid ? strValue : null, valid };
  }

  static parseNumeric(value: unknown): ParsedNumeric {
    if (value === null || value === undefined || value === '') {
      return { value: null, valid: false, parsed: false };
    }

    if (typeof value === 'number') {
      return { value, valid: true, parsed: true };
    }

    const cleaned = String(value).replace(/[,$]/g, '').trim();
    const num = parseFloat(cleaned);

    if (isNaN(num) || !isFinite(num)) {
      return { value: null, valid: false, parsed: false };
    }

    return { value: num, valid: true, parsed: true };
  }

  static validateCoordinatePrecision(value: number): boolean {
    const str = value.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1].length;
      return decimals <= 6;
    }
    return true;
  }

  static validateNumericPrecision(value: number): boolean {
    const str = value.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1].length;
      return decimals <= 2;
    }
    return true;
  }

  static detectAmbiguity(
    rowData: Record<string, unknown>,
    schema: Record<string, string>,
  ): { isAmbiguous: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (schema.currencyColumn) {
      const currency = rowData[schema.currencyColumn];
      const parsed = this.normalizeCurrency(currency);
      if (!parsed.valid) {
        reasons.push('missing_or_invalid_currency');
      }
    }

    if (schema.jurisdictionColumn) {
      const jurisdiction = rowData[schema.jurisdictionColumn];
      if (!jurisdiction || String(jurisdiction).trim() === '') {
        reasons.push('missing_jurisdiction');
      }
    }

    if (schema.assetTypeColumn) {
      const assetType = rowData[schema.assetTypeColumn];
      if (!assetType || String(assetType).trim() === '') {
        reasons.push('missing_asset_type');
      }
    }

    if (schema.latitudeColumn && schema.longitudeColumn) {
      const lat = this.parseLatitude(rowData[schema.latitudeColumn]);
      const lng = this.parseLongitude(rowData[schema.longitudeColumn]);

      if ((lat.parsed && !lat.valid) || (lng.parsed && !lng.valid)) {
        reasons.push('invalid_coordinates');
      }
    }

    return {
      isAmbiguous: reasons.length > 0,
      reasons,
    };
  }

  static calculateInitialConfidence(
    hasExactSchemaMatch: boolean,
    hasAllFields: boolean,
  ): number {
    let confidence = 0.5;

    if (hasExactSchemaMatch) {
      confidence += 0.3;
    }

    if (hasAllFields) {
      confidence += 0.2;
    } else {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  static matchColumn(
    columnName: string,
    canonicalType: keyof typeof CANONICAL_MAPPINGS,
  ): boolean {
    const normalized = columnName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const keywords = CANONICAL_MAPPINGS[canonicalType];

    return keywords.some(kw => 
      normalized.includes(kw) || kw.includes(normalized)
    );
  }

  static inferColumnTypes(
    columns: string[],
    sampleRows: Record<string, unknown>[],
  ): Record<string, string> {
    const columnTypes: Record<string, string> = {};

    for (const col of columns) {
      const values = sampleRows.slice(0, 5).map(r => r[col]).filter(v => v !== null && v !== undefined);

      if (values.length === 0) {
        columnTypes[col] = 'unknown';
        continue;
      }

      const allNumeric = values.every(v => typeof v === 'number' || !isNaN(parseFloat(String(v))));
      if (allNumeric) {
        const firstVal = values[0];
        if (this.matchColumn(col, 'latitude') || this.matchColumn(col, 'longitude')) {
          columnTypes[col] = 'coordinate';
        } else {
          columnTypes[col] = 'number';
        }
        continue;
      }

      const allCurrency = values.every(v => {
        const str = String(v).toUpperCase();
        return VALID_CURRENCIES.has(str) || str.length === 3;
      });
      if (allCurrency) {
        columnTypes[col] = 'currency';
        continue;
      }

      columnTypes[col] = 'string';
    }

    return columnTypes;
  }

  static detectDataStartRow(
    rows: Record<string, unknown>[],
    minColumns: number = 2,
  ): number {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
      
      if (values.length >= minColumns) {
        return i;
      }
    }
    return 0;
  }

  static normalizeRowData(
    row: Record<string, unknown>,
    columnMapping: Record<string, string>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [col, value] of Object.entries(row)) {
      const canonical = columnMapping[col];
      
      if (canonical === 'latitude') {
        const parsed = this.parseLatitude(value);
        normalized[col] = parsed.valid ? parsed.value : null;
      } else if (canonical === 'longitude') {
        const parsed = this.parseLongitude(value);
        normalized[col] = parsed.valid ? parsed.value : null;
      } else if (canonical === 'currency') {
        const parsed = this.normalizeCurrency(value);
        normalized[col] = parsed.valid ? parsed.value : null;
      } else if (canonical === 'value') {
        const parsed = this.parseNumeric(value);
        normalized[col] = parsed.valid ? parsed.value : null;
      } else {
        normalized[col] = value;
      }
    }

    return normalized;
  }
}