import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { FieldEvidenceEntity } from '../entities/field-evidence.entity';

@Injectable()
export class FieldEvidenceRepository {
  constructor(
    @InjectRepository(FieldEvidenceEntity)
    private readonly repository: Repository<FieldEvidenceEntity>,
  ) {}

  async create(
    data: Partial<FieldEvidenceEntity>,
  ): Promise<FieldEvidenceEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<FieldEvidenceEntity | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByCanonicalFieldId(
    canonicalFieldId: string,
  ): Promise<FieldEvidenceEntity[]> {
    return this.repository.find({
      where: { canonicalFieldId } as FindOptionsWhere<FieldEvidenceEntity>,
    });
  }

  async findByExtractedFieldId(
    extractedFieldId: string,
  ): Promise<FieldEvidenceEntity[]> {
    return this.repository.find({
      where: { extractedFieldId } as FindOptionsWhere<FieldEvidenceEntity>,
    });
  }

  async findByRole(
    canonicalFieldId: string,
    role: string,
  ): Promise<FieldEvidenceEntity[]> {
    return this.repository.find({
      where: {
        canonicalFieldId,
        evidenceRole: role,
      } as FindOptionsWhere<FieldEvidenceEntity>,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByCanonicalFieldId(canonicalFieldId: string): Promise<void> {
    await this.repository.delete({
      canonicalFieldId,
    });
  }

  async deleteByExtractedFieldId(extractedFieldId: string): Promise<void> {
    await this.repository.delete({
      extractedFieldId,
    });
  }
}
