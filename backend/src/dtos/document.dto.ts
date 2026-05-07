import { DocumentIngestionStatus } from '../entities/document.entity';

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
