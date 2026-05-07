import { DocumentIngestionStatus } from '../entities/document.entity';
import { JobStatus } from '../utils/extraction.types';

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
