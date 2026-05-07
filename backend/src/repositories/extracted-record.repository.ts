import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ExtractedRecordEntity } from '../entities/extracted-record.entity';

@Injectable()
export class ExtractedRecordRepository {
  constructor(
    @InjectRepository(ExtractedRecordEntity)
    private readonly repository: Repository<ExtractedRecordEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createMany(
    records: Partial<ExtractedRecordEntity>[],
  ): Promise<ExtractedRecordEntity[]> {
    const entities = records.map((r) => this.repository.create(r));
    return this.repository.save(entities);
  }

  async findByResultId(resultId: string): Promise<ExtractedRecordEntity[]> {
    return this.repository.find({ where: { extractionResultId: resultId } });
  }

  async deleteByResultId(resultId: string): Promise<void> {
    await this.repository.delete({ extractionResultId: resultId });
  }
}