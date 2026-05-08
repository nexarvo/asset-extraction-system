import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { CanonicalAssetFieldEntity } from '../entities/canonical-asset-field.entity';

@Injectable()
export class CanonicalAssetFieldRepository {
  constructor(
    @InjectRepository(CanonicalAssetFieldEntity)
    private readonly repository: Repository<CanonicalAssetFieldEntity>,
  ) {}

  async create(
    data: Partial<CanonicalAssetFieldEntity>,
  ): Promise<CanonicalAssetFieldEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<CanonicalAssetFieldEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['selectedEvidence'],
    });
  }

  async findByCanonicalAssetId(
    canonicalAssetId: string,
  ): Promise<CanonicalAssetFieldEntity[]> {
    return this.repository.find({
      where: {
        canonicalAssetId,
      } as FindOptionsWhere<CanonicalAssetFieldEntity>,
    });
  }

  async findByFieldName(
    canonicalAssetId: string,
    fieldName: string,
  ): Promise<CanonicalAssetFieldEntity | null> {
    return this.repository.findOne({
      where: {
        canonicalAssetId,
        fieldName,
      },
    });
  }

  async updateResolvedValue(
    id: string,
    resolvedValue: object,
    explanation?: string,
  ): Promise<void> {
    await this.repository.update(id, { resolvedValue, explanation });
  }

  async setSelectedEvidence(id: string, evidenceId: string): Promise<void> {
    await this.repository.update(id, { selectedEvidenceId: evidenceId });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByCanonicalAssetId(canonicalAssetId: string): Promise<void> {
    await this.repository.delete({
      canonicalAssetId,
    });
  }
}
