import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExtractedAssetEntity } from './extracted-asset.entity';
import { CanonicalAssetEntity } from './canonical-asset.entity';

export enum AssetMatchDecision {
  MATCHED = 'matched',
  MERGED = 'merged',
  DISTINCT = 'distinct',
  AMBIGUOUS = 'ambiguous',
}

@Entity('asset_matches')
export class AssetMatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'extracted_asset_id', type: 'uuid' })
  extractedAssetId!: string;

  @ManyToOne(() => ExtractedAssetEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'extracted_asset_id' })
  extractedAsset!: ExtractedAssetEntity;

  @Column({ name: 'canonical_asset_id', type: 'uuid' })
  canonicalAssetId!: string;

  @ManyToOne(() => CanonicalAssetEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonical_asset_id' })
  canonicalAsset!: CanonicalAssetEntity;

  @Column({ name: 'match_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  @Index()
  matchScore!: number | null;

  @Column({ name: 'match_strategy', type: 'varchar', nullable: true })
  matchStrategy!: string | null;

  @Column({ name: 'match_explanation', type: 'text', nullable: true })
  matchExplanation!: string | null;

  @Column({
    type: 'enum',
    enum: AssetMatchDecision,
  })
  decision!: AssetMatchDecision;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}