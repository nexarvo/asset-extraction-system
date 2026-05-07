import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AssetChangeEventEntity } from '../entities/asset-change-event.entity';

@Injectable()
export class AssetChangeEventRepository {
  constructor(
    @InjectRepository(AssetChangeEventEntity)
    private readonly repository: Repository<AssetChangeEventEntity>,
  ) {}

  async create(data: Partial<AssetChangeEventEntity>): Promise<AssetChangeEventEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<AssetChangeEventEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<AssetChangeEventEntity> });
  }

  async findByCanonicalAssetId(canonicalAssetId: string): Promise<AssetChangeEventEntity[]> {
    return this.repository.find({ where: { canonicalAssetId } as FindOptionsWhere<AssetChangeEventEntity>, order: { createdAt: 'DESC' } });
  }

async findByFieldName(canonicalAssetId: string, fieldName: string): Promise<AssetChangeEventEntity[]> {
    const where: FindOptionsWhere<AssetChangeEventEntity> = { canonicalAssetId, fieldName };
    return this.repository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findByPreviousVersionId(previousVersionId: string): Promise<AssetChangeEventEntity[]> {
    return this.repository.find({ where: { previousVersionId } as FindOptionsWhere<AssetChangeEventEntity> });
  }

  async findByNewVersionId(newVersionId: string): Promise<AssetChangeEventEntity[]> {
    return this.repository.find({ where: { newVersionId } as FindOptionsWhere<AssetChangeEventEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[AssetChangeEventEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByCanonicalAssetId(canonicalAssetId: string): Promise<void> {
    await this.repository.delete({ canonicalAssetId } as FindOptionsWhere<AssetChangeEventEntity>);
  }
}