import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AssetVersionEntity } from '../entities/asset-version.entity';

@Injectable()
export class AssetVersionRepository {
  constructor(
    @InjectRepository(AssetVersionEntity)
    private readonly repository: Repository<AssetVersionEntity>,
  ) {}

  async create(data: Partial<AssetVersionEntity>): Promise<AssetVersionEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<AssetVersionEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<AssetVersionEntity> });
  }

  async findByCanonicalAssetId(canonicalAssetId: string): Promise<AssetVersionEntity[]> {
    return this.repository.find({ where: { canonicalAssetId } as FindOptionsWhere<AssetVersionEntity>, order: { versionNumber: 'DESC' } });
  }

  async findLatestVersion(canonicalAssetId: string): Promise<AssetVersionEntity | null> {
    return this.repository.findOne({
      where: { canonicalAssetId } as FindOptionsWhere<AssetVersionEntity>,
      order: { versionNumber: 'DESC' },
    });
  }

  async findByVersionNumber(canonicalAssetId: string, versionNumber: number): Promise<AssetVersionEntity | null> {
    return this.repository.findOne({ where: { canonicalAssetId, versionNumber } as FindOptionsWhere<AssetVersionEntity> });
  }

  async getNextVersionNumber(canonicalAssetId: string): Promise<number> {
    const latest = await this.findLatestVersion(canonicalAssetId);
    return latest ? latest.versionNumber + 1 : 1;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByCanonicalAssetId(canonicalAssetId: string): Promise<void> {
    await this.repository.delete({ canonicalAssetId } as FindOptionsWhere<AssetVersionEntity>);
  }
}