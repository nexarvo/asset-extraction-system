import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExtractionResultEntity } from '../entities/extraction-result.entity';

@Injectable()
export class ExtractionResultRepository {
  constructor(
    @InjectRepository(ExtractionResultEntity)
    private readonly repository: Repository<ExtractionResultEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(result: Partial<ExtractionResultEntity>): Promise<ExtractionResultEntity> {
    const entity = this.repository.create(result);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ExtractionResultEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['records'],
    });
  }

  async findByJobId(jobId: string): Promise<ExtractionResultEntity | null> {
    return this.repository.findOne({ where: { jobId } });
  }

  async findAll(): Promise<ExtractionResultEntity[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}