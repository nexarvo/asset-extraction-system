import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExtractionJobEntity, ExtractionJobStatus } from '../entities/extraction-job.entity';

@Injectable()
export class ExtractionJobRepository {
  constructor(
    @InjectRepository(ExtractionJobEntity)
    private readonly repository: Repository<ExtractionJobEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(job: Partial<ExtractionJobEntity>): Promise<ExtractionJobEntity> {
    const entity = this.repository.create(job);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ExtractionJobEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findAll(): Promise<ExtractionJobEntity[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(
    id: string,
    status: ExtractionJobStatus,
    additionalFields?: Partial<ExtractionJobEntity>,
  ): Promise<ExtractionJobEntity | null> {
    const updateData: Record<string, unknown> = { status };
    if (additionalFields) {
      if (additionalFields.errorMessage !== undefined) {
        updateData.errorMessage = additionalFields.errorMessage;
      }
      if (additionalFields.completedAt !== undefined) {
        updateData.completedAt = additionalFields.completedAt;
      }
    }
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.repository.increment({ id }, 'attempts', 1);
  }

  async setError(id: string, message: string): Promise<void> {
    await this.repository.update(id, { errorMessage: message });
  }

  async markCompleted(id: string): Promise<void> {
    await this.repository.update(id, {
      status: ExtractionJobStatus.COMPLETED,
      completedAt: new Date(),
    });
  }

  async findByStatus(status: ExtractionJobStatus): Promise<ExtractionJobEntity[]> {
    return this.repository.find({ where: { status } });
  }
}