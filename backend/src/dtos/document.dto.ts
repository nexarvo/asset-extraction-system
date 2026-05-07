import { DocumentIngestionStatus } from '../entities/document.entity';
import { JobStatus } from '../utils/extraction.types';
import { ExtractedAssetReviewStatus, ExtractionMethod, ValidationStatus } from '../entities/extracted-asset-field.entity';

export class CreateDocumentDto {
  readonly originalFileName!: string;
  readonly storageKey!: string;
  readonly mimeType?: string | null;
  readonly fileSize?: number | null;
  readonly checksumSha256?: string | null;
  readonly uploadedBy?: string | null;
  readonly uploadSource?: string | null;
}

export class UpdateDocumentDto {
  readonly originalFileName?: string;
  readonly ingestionStatus?: DocumentIngestionStatus;
}

export class ListDocumentsDto {
  readonly jobIds?: string[];
}

export class DocumentWithJobResponseDto {
  readonly jobId!: string;
  readonly documentId!: string;
  readonly originalFileName!: string;
  readonly storageKey!: string;
  readonly mimeType!: string | null;
  readonly fileSize!: number | null;
  readonly status!: JobStatus;
  readonly progress!: number;
  readonly error?: string;
  readonly createdAt!: Date;
}

export class DocumentResponseDto {
  readonly id!: string;
  readonly originalFileName!: string;
  readonly storageKey!: string;
  readonly mimeType!: string | null;
  readonly fileSize!: number | null;
  readonly checksumSha256!: string | null;
  readonly uploadedBy!: string | null;
  readonly uploadSource!: string | null;
  readonly ingestionStatus!: DocumentIngestionStatus;
  readonly createdAt!: Date;
}

export class ExtractedFieldDto {
  readonly id!: string;
  readonly fieldName!: string;
  readonly rawValue!: string | null;
  readonly normalizedValue!: object | null;
  readonly confidenceScore!: number | null;
  readonly extractionMethod!: ExtractionMethod | null;
  readonly reviewStatus!: ExtractedAssetReviewStatus;
  readonly validationStatus!: ValidationStatus | null;
  readonly sourceRowIndex!: number | null;
  readonly sourceSheetName!: string | null;
  readonly isInferred!: boolean;
  readonly createdAt!: Date;
}

export class ReviewResponseDto {
  readonly documentId!: string;
  readonly originalFileName!: string;
  readonly mimeType!: string | null;
  readonly totalFields!: number;
  readonly page!: number;
  readonly pageSize!: number;
  readonly fields!: ExtractedFieldDto[];
}
