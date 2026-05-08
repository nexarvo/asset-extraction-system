import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindOptionsRelations } from 'typeorm';
import {
  CanonicalAssetEntity,
  CanonicalAssetReviewStatus,
} from '../entities/canonical-asset.entity';

@Injectable()
export class CanonicalAssetRepository {
  constructor(
    @InjectRepository(CanonicalAssetEntity)
    private readonly repository: Repository<CanonicalAssetEntity>,
  ) {}

  async create(
    data: Partial<CanonicalAssetEntity>,
  ): Promise<CanonicalAssetEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<CanonicalAssetEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['fields'],
    });
  }

  async findByName(name: string): Promise<CanonicalAssetEntity[]> {
    return this.repository.find({
      where: { canonicalName: name } as FindOptionsWhere<CanonicalAssetEntity>,
    });
  }

  async findByJurisdiction(
    jurisdiction: string,
  ): Promise<CanonicalAssetEntity[]> {
    return this.repository.find({
      where: { jurisdiction } as FindOptionsWhere<CanonicalAssetEntity>,
    });
  }

  async findByAssetType(assetType: string): Promise<CanonicalAssetEntity[]> {
    return this.repository.find({
      where: { assetType } as FindOptionsWhere<CanonicalAssetEntity>,
    });
  }

  async findByReviewStatus(
    status: CanonicalAssetReviewStatus,
  ): Promise<CanonicalAssetEntity[]> {
    return this.repository.find({
      where: { reviewStatus: status } as FindOptionsWhere<CanonicalAssetEntity>,
    });
  }

  async findByDuplicateClusterId(
    clusterId: string,
  ): Promise<CanonicalAssetEntity[]> {
    return this.repository.find({
      where: {
        duplicateClusterId: clusterId,
      } as FindOptionsWhere<CanonicalAssetEntity>,
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
  }): Promise<[CanonicalAssetEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
      relations: ['fields'],
    });
  }

  async updateReviewStatus(
    id: string,
    status: CanonicalAssetReviewStatus,
  ): Promise<void> {
    await this.repository.update(id, { reviewStatus: status });
  }

  async updateActiveVersion(id: string, versionId: string): Promise<void> {
    await this.repository.update(id, { activeVersionId: versionId });
  }

  async setDuplicateCluster(id: string, clusterId: string): Promise<void> {
    await this.repository.update(id, { duplicateClusterId: clusterId });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
