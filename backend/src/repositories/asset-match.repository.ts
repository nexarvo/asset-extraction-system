import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  AssetMatchEntity,
  AssetMatchDecision,
} from '../entities/asset-match.entity';

@Injectable()
export class AssetMatchRepository {
  constructor(
    @InjectRepository(AssetMatchEntity)
    private readonly repository: Repository<AssetMatchEntity>,
  ) {}

  async create(data: Partial<AssetMatchEntity>): Promise<AssetMatchEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<AssetMatchEntity | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByExtractedAssetId(
    extractedAssetId: string,
  ): Promise<AssetMatchEntity[]> {
    return this.repository.find({
      where: { extractedAssetId } as FindOptionsWhere<AssetMatchEntity>,
      relations: ['canonicalAsset'],
    });
  }

  async findByCanonicalAssetId(
    canonicalAssetId: string,
  ): Promise<AssetMatchEntity[]> {
    return this.repository.find({
      where: { canonicalAssetId } as FindOptionsWhere<AssetMatchEntity>,
      relations: ['extractedAsset'],
    });
  }

  async findByDecision(
    decision: AssetMatchDecision,
  ): Promise<AssetMatchEntity[]> {
    return this.repository.find({
      where: { decision } as FindOptionsWhere<AssetMatchEntity>,
    });
  }

  async findByMatchScore(minScore: number): Promise<AssetMatchEntity[]> {
    return this.repository
      .createQueryBuilder('match')
      .where('match.match_score >= :minScore', { minScore })
      .getMany();
  }

  async updateDecision(
    id: string,
    decision: AssetMatchDecision,
  ): Promise<void> {
    await this.repository.update(id, { decision });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByExtractedAssetId(extractedAssetId: string): Promise<void> {
    await this.repository.delete({
      extractedAssetId,
    });
  }

  async deleteByCanonicalAssetId(canonicalAssetId: string): Promise<void> {
    await this.repository.delete({
      canonicalAssetId,
    });
  }
}
