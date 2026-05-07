import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../core/app-logger.service';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentEntity, DocumentIngestionStatus } from '../entities/document.entity';
import { CreateDocumentDto, UpdateDocumentDto, DocumentResponseDto } from '../dtos';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentRepository,
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

    this.logger.log('Document created', 'DocumentsService', { documentId: entity.id });
    return this.toResponseDto(entity);
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<{ documents: DocumentResponseDto[]; total: number }> {
    const [entities, total] = await this.documentRepository.findAll(options);
    return {
      documents: entities.map((entity) => this.toResponseDto(entity)),
      total,
    };
  }

  async findOne(id: string): Promise<DocumentResponseDto | null> {
    const entity = await this.documentRepository.findById(id);
    if (!entity) {
      return null;
    }
    return this.toResponseDto(entity);
  }

  async update(id: string, dto: UpdateDocumentDto): Promise<DocumentResponseDto | null> {
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
}

export { CreateDocumentDto, UpdateDocumentDto, DocumentResponseDto };
