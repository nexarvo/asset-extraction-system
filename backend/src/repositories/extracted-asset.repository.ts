import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ExtractedAssetEntity, ExtractedAssetReviewStatus } from '../entities/extracted-asset.entity';

@Injectable()
export class ExtractedAssetRepository {
  constructor(
    @InjectRepository(ExtractedAssetEntity)
    private readonly repository: Repository<ExtractedAssetEntity>,
  ) {}

  async create(data: Partial<ExtractedAssetEntity>): Promise<ExtractedAssetEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ExtractedAssetEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<ExtractedAssetEntity>, relations: ['fields'] });
  }

  async findByDocumentId(documentId: string): Promise<ExtractedAssetEntity[]> {
    return this.repository.find({ where: { documentId } as FindOptionsWhere<ExtractedAssetEntity>, order: { createdAt: 'DESC' } });
  }

  async findByReviewStatus(status: ExtractedAssetReviewStatus): Promise<ExtractedAssetEntity[]> {
    return this.repository.find({ where: { reviewStatus: status } as FindOptionsWhere<ExtractedAssetEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[ExtractedAssetEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
      relations: ['fields'],
    });
  }

  async updateReviewStatus(id: string, status: ExtractedAssetReviewStatus): Promise<void> {
    await this.repository.update(id, { reviewStatus: status });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}