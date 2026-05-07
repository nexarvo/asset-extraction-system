import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExtractionErrorEntity } from '../entities/extraction-error.entity';

export interface BulkInsertErrorData {
  processingJobId: string | null;
  errorStage: string;
  errorCode: string;
  message: string;
  recoverable: boolean;
  stackTrace?: string;
  createdAt: Date;
}

@Injectable()
export class ExtractionErrorRepository {
  constructor(
    @InjectRepository(ExtractionErrorEntity)
    private readonly repository: Repository<ExtractionErrorEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    error: Partial<ExtractionErrorEntity>,
  ): Promise<ExtractionErrorEntity> {
    const entity = this.repository.create(error);
    return this.repository.save(entity);
  }

  async bulkInsert(errors: BulkInsertErrorData[]): Promise<number> {
    if (errors.length === 0) return 0;

    const entities = errors.map((e) => {
      const entity = new ExtractionErrorEntity();
      entity.processingJobId = e.processingJobId;
      entity.errorStage = e.errorStage;
      entity.errorCode = e.errorCode;
      entity.message = e.message;
      entity.recoverable = e.recoverable;
      entity.stackTrace = e.stackTrace || null;
      entity.createdAt = e.createdAt;
      return entity;
    });

    const saved = await this.repository.save(entities);
    return saved.length;
  }

  async findByProcessingJobId(
    processingJobId: string,
  ): Promise<ExtractionErrorEntity[]> {
    return this.repository.find({
      where: { processingJobId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteByProcessingJobId(processingJobId: string): Promise<void> {
    await this.repository.delete({ processingJobId });
  }
}
