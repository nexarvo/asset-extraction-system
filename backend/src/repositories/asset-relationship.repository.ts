import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { AssetRelationshipEntity } from '../entities/asset-relationship.entity';

@Injectable()
export class AssetRelationshipRepository {
  constructor(
    @InjectRepository(AssetRelationshipEntity)
    private readonly repository: Repository<AssetRelationshipEntity>,
  ) {}

  async create(data: Partial<AssetRelationshipEntity>): Promise<AssetRelationshipEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<AssetRelationshipEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<AssetRelationshipEntity> });
  }

  async findByParentAssetId(parentAssetId: string): Promise<AssetRelationshipEntity[]> {
    return this.repository.find({ where: { parentAssetId } as FindOptionsWhere<AssetRelationshipEntity>, relations: ['childAsset'] });
  }

  async findByChildAssetId(childAssetId: string): Promise<AssetRelationshipEntity[]> {
    return this.repository.find({ where: { childAssetId } as FindOptionsWhere<AssetRelationshipEntity>, relations: ['parentAsset'] });
  }

  async findByRelationshipType(relationshipType: string): Promise<AssetRelationshipEntity[]> {
    return this.repository.find({ where: { relationshipType } as FindOptionsWhere<AssetRelationshipEntity> });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByParentAssetId(parentAssetId: string): Promise<void> {
    await this.repository.delete({ parentAssetId } as FindOptionsWhere<AssetRelationshipEntity>);
  }

  async deleteByChildAssetId(childAssetId: string): Promise<void> {
    await this.repository.delete({ childAssetId } as FindOptionsWhere<AssetRelationshipEntity>);
  }
}