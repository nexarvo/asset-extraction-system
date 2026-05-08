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
import { AssetVersionEntity } from './asset-version.entity';

@Entity('asset_change_events')
export class AssetChangeEventEntity {
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

  @Column({ name: 'previous_version_id', type: 'uuid', nullable: true })
  previousVersionId!: string | null;

  @ManyToOne(() => AssetVersionEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'previous_version_id' })
  previousVersion!: AssetVersionEntity | null;

  @Column({ name: 'new_version_id', type: 'uuid', nullable: true })
  newVersionId!: string | null;

  @ManyToOne(() => AssetVersionEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'new_version_id' })
  newVersion!: AssetVersionEntity | null;

  @Column({ name: 'field_name', type: 'varchar' })
  fieldName!: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue!: object | null;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue!: object | null;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;

  @Column({
    name: 'confidence_delta',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceDelta!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
