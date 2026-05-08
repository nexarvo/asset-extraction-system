import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DataSource } from 'typeorm';
import {
  ExtractedAssetFieldEntity,
  ValidationStatus,
} from '../entities/extracted-asset-field.entity';

export interface BulkInsertFieldData {
  documentId: string;
  extractionJobId: string | null;
  rawAssetName: string | null;
  overallConfidence: number | null;
  reviewStatus: string;
  extractionStrategy: string | null;
  fieldName: string;
  rawValue: string | null;
  normalizedValue: string | null;
  confidenceScore: number | null;
  extractionMethod: string | null;
  sourceRowIndex: number;
  sourceSheetName: string | null;
  isInferred: boolean;
  createdAt: Date;
}

@Injectable()
export class ExtractedAssetFieldRepository {
  constructor(
    @InjectRepository(ExtractedAssetFieldEntity)
    private readonly repository: Repository<ExtractedAssetFieldEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    data: Partial<ExtractedAssetFieldEntity>,
  ): Promise<ExtractedAssetFieldEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async createMany(
    data: Partial<ExtractedAssetFieldEntity>[],
  ): Promise<ExtractedAssetFieldEntity[]> {
    const entities = this.repository.create(data);
    return this.repository.save(entities);
  }

  async bulkInsert(data: BulkInsertFieldData[]): Promise<number> {
    if (data.length === 0) return 0;

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('extracted_asset_fields')
      .values(data)
      .execute();

    return data.length;
  }

  async bulkInsertWithTransaction(
    data: BulkInsertFieldData[],
  ): Promise<number> {
    if (data.length === 0) return 0;

    const validData = data.filter(
      (d) => d.fieldName && d.fieldName.trim() !== '',
    );
    if (validData.length === 0) return 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalSaved = 0;
      const CHUNK_SIZE = 100;

      for (let i = 0; i < validData.length; i += CHUNK_SIZE) {
        const chunk = validData.slice(i, i + CHUNK_SIZE);
        const entities = chunk.map((d) => {
          const entity = new ExtractedAssetFieldEntity();
          entity.documentId = d.documentId;
          entity.extractionJobId = d.extractionJobId;
          entity.rawAssetName = d.rawAssetName;
          entity.overallConfidence = d.overallConfidence;
          entity.reviewStatus = d.reviewStatus as any;
          entity.extractionStrategy = d.extractionStrategy;
          entity.fieldName = d.fieldName;
          entity.rawValue = d.rawValue;
          entity.normalizedValue = d.normalizedValue
            ? JSON.parse(d.normalizedValue)
            : null;
          entity.confidenceScore = d.confidenceScore;
          entity.extractionMethod = d.extractionMethod as any;
          entity.sourceRowIndex = d.sourceRowIndex;
          entity.sourceSheetName = d.sourceSheetName;
          entity.isInferred = d.isInferred;
          entity.createdAt = d.createdAt;
          return entity;
        });

        const saved = await queryRunner.manager.save(entities);
        totalSaved += saved.length;
      }

      await queryRunner.commitTransaction();
      return totalSaved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<ExtractedAssetFieldEntity | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository.find({
      where: { documentId } as FindOptionsWhere<ExtractedAssetFieldEntity>,
    });
  }

  async findByFieldName(
    fieldName: string,
  ): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository.find({
      where: { fieldName } as FindOptionsWhere<ExtractedAssetFieldEntity>,
    });
  }

  async findByConfidenceScore(
    minScore: number,
  ): Promise<ExtractedAssetFieldEntity[]> {
    return this.repository
      .createQueryBuilder('field')
      .where('field.confidence_score >= :minScore', { minScore })
      .getMany();
  }

  async updateValidationStatus(
    id: string,
    status: ValidationStatus,
  ): Promise<void> {
    await this.repository.update(id, { validationStatus: status });
  }

  async update(
    id: string,
    data: Partial<ExtractedAssetFieldEntity>,
  ): Promise<void> {
    await this.repository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.repository.delete({
      documentId,
    });
  }

  async findByDocumentIdPaginated(
    documentId: string,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<{ fields: ExtractedAssetFieldEntity[]; total: number }> {
    const [fields, total] = await this.repository.findAndCount({
      where: { documentId } as FindOptionsWhere<ExtractedAssetFieldEntity>,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { fields, total };
  }
}
