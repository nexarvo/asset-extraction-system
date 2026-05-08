import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { DuplicateClusterEntity } from './duplicate-cluster.entity';
import { AssetVersionEntity } from './asset-version.entity';
import { CanonicalAssetFieldEntity } from './canonical-asset-field.entity';

export enum CanonicalAssetReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('canonical_assets')
export class CanonicalAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'canonical_name', type: 'varchar' })
  @Index()
  canonicalName!: string;

  @Column({ name: 'asset_type', type: 'varchar', nullable: true })
  @Index()
  assetType!: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  jurisdiction!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  @Column({
    name: 'canonical_value',
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
  })
  canonicalValue!: number | null;

  @Column({
    name: 'overall_confidence',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  overallConfidence!: number | null;

  @Column({
    type: 'enum',
    enum: CanonicalAssetReviewStatus,
    default: CanonicalAssetReviewStatus.PENDING,
  })
  reviewStatus!: CanonicalAssetReviewStatus;

  @Column({ name: 'duplicate_cluster_id', type: 'uuid', nullable: true })
  duplicateClusterId!: string | null;

  @ManyToOne(() => DuplicateClusterEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'duplicate_cluster_id' })
  duplicateCluster!: DuplicateClusterEntity | null;

  @Column({ name: 'active_version_id', type: 'uuid', nullable: true })
  activeVersionId!: string | null;

  @ManyToOne(() => AssetVersionEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'active_version_id' })
  activeVersion!: AssetVersionEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => CanonicalAssetFieldEntity, (field) => field.canonicalAsset)
  fields!: CanonicalAssetFieldEntity[];
}
