import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ExtractedAssetFieldEntity, ValidationStatus } from '../entities/extracted-asset-field.entity';

@Injectable()
export class ExtractedAssetFieldRepository {
  constructor(
    @InjectRepository(ExtractedAssetFieldEntity)
    private readonly repository: Repository<ExtractedAssetFieldEntity>,
  ) {}

  async create(data: Partial<ExtractedAssetFieldEntity>): Promise<ExtractedAssetFieldEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async createMany(data: Partial<ExtractedAssetFieldEntity>[]): Promise<ExtractedAssetFieldEntity[]> {
    const entities = this.repository.create(data);
    return this.repository.save(entities);
  }

  async findById(id: string): Promise<ExtractedAssetFieldEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<ExtractedAssetFieldEntity> });
  }

  async findByDocumentId(documentId: string): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository.find({ where: { documentId } as FindOptionsWhere<ExtractedAssetFieldEntity> });
  }

  async findByFieldName(fieldName: string): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository.find({ where: { fieldName } as FindOptionsWhere<ExtractedAssetFieldEntity> });
  }

  async findByConfidenceScore(minScore: number): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository.createQueryBuilder('field').where('field.confidence_score >= :minScore', { minScore }).getMany();
  }

  async updateValidationStatus(id: string, status: ValidationStatus): Promise<void> {
    await this.repository.update(id, { validationStatus: status });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.repository.delete({ documentId } as FindOptionsWhere<ExtractedAssetFieldEntity>);
  }
}