import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractionErrorEntity } from '../entities/extraction-error.entity';

@Injectable()
export class ExtractionErrorRepository {
  constructor(
    @InjectRepository(ExtractionErrorEntity)
    private readonly repository: Repository<ExtractionErrorEntity>,
  ) {}

  async create(error: Partial<ExtractionErrorEntity>): Promise<ExtractionErrorEntity> {
    const entity = this.repository.create(error);
    return this.repository.save(entity);
  }

  async findByProcessingJobId(processingJobId: string): Promise<ExtractionErrorEntity[]> {
    return this.repository.find({ where: { processingJobId }, order: { createdAt: 'DESC' } });
  }

  async deleteByProcessingJobId(processingJobId: string): Promise<void> {
    await this.repository.delete({ processingJobId });
  }
}