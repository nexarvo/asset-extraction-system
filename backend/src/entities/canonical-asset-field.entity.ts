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
import { ExtractedAssetFieldEntity } from './extracted-asset-field.entity';

@Entity('canonical_asset_fields')
export class CanonicalAssetFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'canonical_asset_id', type: 'uuid' })
  @Index()
  canonicalAssetId!: string;

  @ManyToOne(() => CanonicalAssetEntity, (asset) => asset.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonical_asset_id' })
  canonicalAsset!: CanonicalAssetEntity;

  @Column({ name: 'field_name', type: 'varchar' })
  fieldName!: string;

  @Column({ name: 'resolved_value', type: 'jsonb', nullable: true })
  resolvedValue!: object | null;

  @Column({ name: 'selected_evidence_id', type: 'uuid', nullable: true })
  selectedEvidenceId!: string | null;

  @ManyToOne(() => ExtractedAssetFieldEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'selected_evidence_id' })
  selectedEvidence!: ExtractedAssetFieldEntity | null;

  @Column({ name: 'resolution_strategy', type: 'varchar', nullable: true })
  resolutionStrategy!: string | null;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore!: number | null;

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
