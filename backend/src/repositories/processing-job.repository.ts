import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ProcessingJobEntity, ProcessingJobStatus } from '../entities/processing-job.entity';

@Injectable()
export class ProcessingJobRepository {
  constructor(
    @InjectRepository(ProcessingJobEntity)
    private readonly repository: Repository<ProcessingJobEntity>,
  ) {}

  async create(data: Partial<ProcessingJobEntity>): Promise<ProcessingJobEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ProcessingJobEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<ProcessingJobEntity> });
  }

  async findByDocumentId(documentId: string): Promise<ProcessingJobEntity[]> {
    return this.repository.find({ where: { documentId } as FindOptionsWhere<ProcessingJobEntity>, order: { createdAt: 'DESC' } });
  }

  async findByStatus(status: ProcessingJobStatus): Promise<ProcessingJobEntity[]> {
    return this.repository.find({ where: { status } as FindOptionsWhere<ProcessingJobEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[ProcessingJobEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: ProcessingJobStatus): Promise<void> {
    await this.repository.update(id, { status });
  }

  async markCompleted(id: string): Promise<void> {
    await this.repository.update(id, { status: ProcessingJobStatus.COMPLETED, completedAt: new Date() });
  }

  async setError(id: string, errorSummary: string): Promise<void> {
    await this.repository.update(id, { status: ProcessingJobStatus.FAILED, errorSummary, completedAt: new Date() });
  }

  async incrementAttempt(id: string): Promise<void> {
    await this.repository.increment({ id }, 'attemptCount', 1);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}