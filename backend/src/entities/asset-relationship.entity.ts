import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CanonicalAssetEntity } from './canonical-asset.entity';

@Entity('asset_relationships')
export class AssetRelationshipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_asset_id', type: 'uuid' })
  @Index()
  parentAssetId!: string;

  @ManyToOne(() => CanonicalAssetEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_asset_id' })
  parentAsset!: CanonicalAssetEntity;

  @Column({ name: 'child_asset_id', type: 'uuid' })
  @Index()
  childAssetId!: string;

  @ManyToOne(() => CanonicalAssetEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'child_asset_id' })
  childAsset!: CanonicalAssetEntity;

  @Column({ name: 'relationship_type', type: 'varchar', nullable: true })
  relationshipType!: string | null;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
