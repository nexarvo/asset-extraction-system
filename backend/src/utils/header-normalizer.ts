import { HeaderNormalizationResult } from './csv-stream.types';

export class HeaderNormalizer {
  static normalize(headers: string[]): HeaderNormalizationResult {
    const normalizedHeaders: string[] = [];
    const seenHeaders = new Map<string, number>();
    const duplicateHeaders: string[] = [];

    for (const header of headers) {
      let normalized = header.trim().toLowerCase();
      normalized = normalized.replace(/\s+/g, '_');
      normalized = normalized.replace(/[^a-z0-9_]/g, '');

      if (seenHeaders.has(normalized)) {
        const count = seenHeaders.get(normalized)! + 1;
        seenHeaders.set(normalized, count);
        duplicateHeaders.push(`${normalized}_${count}`);
        normalized = `${normalized}_${count}`;
      } else {
        seenHeaders.set(normalized, 1);
      }

      normalizedHeaders.push(normalized);
    }

    return { normalizedHeaders, duplicateHeaders };
  }

  static hasRequiredHeaders(
    headers: string[],
    requiredFields: string[],
  ): boolean {
    const normalizedHeaders = this.normalize(headers).normalizedHeaders;
    return requiredFields.every((field) => normalizedHeaders.includes(field));
  }
}
