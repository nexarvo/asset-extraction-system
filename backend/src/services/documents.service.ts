import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { DocumentRepository } from '../repositories/document.repository';
import { ProcessingJobRepository } from '../repositories/processing-job.repository';
import { ExtractedAssetFieldRepository } from '../repositories/extracted-asset-field.repository';
import {
  DocumentEntity,
  DocumentIngestionStatus,
} from '../entities/document.entity';
import {
  ProcessingJobEntity,
  ProcessingJobStatus,
} from '../entities/processing-job.entity';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponseDto,
  ListDocumentsDto,
  DocumentWithJobResponseDto,
  ReviewResponseDto,
  ExtractedFieldDto,
} from '../dtos';
import { JobStatus } from '../utils/extraction.types';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly processingJobRepository: ProcessingJobRepository,
    private readonly extractedAssetFieldRepository: ExtractedAssetFieldRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async create(dto: CreateDocumentDto): Promise<DocumentResponseDto> {
    const entity = await this.documentRepository.create({
      originalFileName: dto.originalFileName,
      storageKey: dto.storageKey,
      mimeType: dto.mimeType ?? null,
      fileSize: dto.fileSize ?? null,
      checksumSha256: dto.checksumSha256 ?? null,
      uploadedBy: dto.uploadedBy ?? null,
      uploadSource: dto.uploadSource ?? null,
      ingestionStatus: DocumentIngestionStatus.UPLOADED,
    });

    this.logger.log('Document created', 'DocumentsService', {
      documentId: entity.id,
    });
    return this.toResponseDto(entity);
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
  }): Promise<{ documents: DocumentResponseDto[]; total: number }> {
    const [entities, total] = await this.documentRepository.findAll(options);
    return {
      documents: entities.map((entity) => this.toResponseDto(entity)),
      total,
    };
  }

  async findByJobIds(
    dto: ListDocumentsDto,
  ): Promise<DocumentWithJobResponseDto[]> {
    if (!dto.jobIds || dto.jobIds.length === 0) {
      return [];
    }

    const jobs = await this.processingJobRepository.findByIds(dto.jobIds);
    const documentIds = [
      ...new Set(
        jobs
          .map((job) => job.documentId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const documents = await this.documentRepository.findByIds(documentIds);

    const documentMap = new Map(documents.map((doc) => [doc.id, doc]));
    const jobMap = new Map(jobs.map((job) => [job.id, job]));

    return dto.jobIds
      .map((jobId) => {
        const job = jobMap.get(jobId);
        if (!job || !job.documentId) return null;

        const document = documentMap.get(job.documentId);
        if (!document) return null;

        return this.toDocumentWithJobResponseDto(document, job);
      })
      .filter((item): item is DocumentWithJobResponseDto => item !== null);
  }

  async findOne(id: string): Promise<DocumentResponseDto | null> {
    const entity = await this.documentRepository.findById(id);
    if (!entity) {
      return null;
    }
    return this.toResponseDto(entity);
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto | null> {
    const entity = await this.documentRepository.findById(id);
    if (!entity) {
      return null;
    }

    if (dto.originalFileName !== undefined) {
      entity.originalFileName = dto.originalFileName;
    }
    if (dto.ingestionStatus !== undefined) {
      await this.documentRepository.updateStatus(id, dto.ingestionStatus);
      entity.ingestionStatus = dto.ingestionStatus;
    }

    this.logger.log('Document updated', 'DocumentsService', { documentId: id });
    return this.toResponseDto(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.documentRepository.findById(id);
    if (!entity) {
      return;
    }

    await this.documentRepository.delete(id);
    this.logger.log('Document deleted', 'DocumentsService', { documentId: id });
  }

  private mapJobStatus(status: ProcessingJobStatus): JobStatus {
    switch (status) {
      case ProcessingJobStatus.QUEUED:
        return 'waiting';
      case ProcessingJobStatus.RUNNING:
        return 'processing';
      case ProcessingJobStatus.COMPLETED:
        return 'completed';
      case ProcessingJobStatus.FAILED:
        return 'failed';
      case ProcessingJobStatus.RETRYING:
        return 'retrying';
      default:
        return status;
    }
  }

  private calculateProgress(status: ProcessingJobStatus): number {
    switch (status) {
      case ProcessingJobStatus.QUEUED:
        return 0;
      case ProcessingJobStatus.RUNNING:
        return 50;
      case ProcessingJobStatus.COMPLETED:
        return 100;
      case ProcessingJobStatus.FAILED:
      case ProcessingJobStatus.RETRYING:
        return 0;
      default:
        return 0;
    }
  }

  private toResponseDto(entity: DocumentEntity): DocumentResponseDto {
    return {
      id: entity.id,
      originalFileName: entity.originalFileName,
      storageKey: entity.storageKey,
      mimeType: entity.mimeType,
      fileSize: entity.fileSize,
      checksumSha256: entity.checksumSha256,
      uploadedBy: entity.uploadedBy,
      uploadSource: entity.uploadSource,
      ingestionStatus: entity.ingestionStatus,
      createdAt: entity.createdAt,
    };
  }

  private toDocumentWithJobResponseDto(
    document: DocumentEntity,
    job: ProcessingJobEntity,
  ): DocumentWithJobResponseDto {
    return {
      jobId: job.id,
      documentId: document.id,
      originalFileName: document.originalFileName,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      status: this.mapJobStatus(job.status),
      progress: this.calculateProgress(job.status),
      error: job.errorSummary ?? undefined,
      createdAt: document.createdAt,
    };
  }

  async review(
    documentId: string,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<ReviewResponseDto | null> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      return null;
    }

    const { fields, total } =
      await this.extractedAssetFieldRepository.findByDocumentIdPaginated(
        documentId,
        page,
        pageSize,
      );

    return {
      documentId: document.id,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      totalFields: total,
      page,
      pageSize,
      fields: fields.map((field) => ({
        id: field.id,
        fieldName: field.fieldName,
        rawValue: field.rawValue,
        normalizedValue: field.normalizedValue,
        confidenceScore: field.confidenceScore,
        extractionMethod: field.extractionMethod,
        reviewStatus: field.reviewStatus,
        validationStatus: field.validationStatus,
        sourceRowIndex: field.sourceRowIndex,
        sourceSheetName: field.sourceSheetName,
        isInferred: field.isInferred,
        createdAt: field.createdAt,
      })),
    };
  }
}

export {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponseDto,
  ListDocumentsDto,
  DocumentWithJobResponseDto,
  ReviewResponseDto,
  ExtractedFieldDto,
};
