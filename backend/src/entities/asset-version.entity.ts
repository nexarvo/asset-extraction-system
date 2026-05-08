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

@Entity('asset_versions')
export class AssetVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'canonical_asset_id', type: 'uuid' })
  @Index()
  canonicalAssetId!: string;

  @ManyToOne(() => CanonicalAssetEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonical_asset_id' })
  canonicalAsset!: CanonicalAssetEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 'snapshot_data', type: 'jsonb' })
  snapshotData!: object;

  @Column({ name: 'created_by_process', type: 'varchar', nullable: true })
  createdByProcess!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
