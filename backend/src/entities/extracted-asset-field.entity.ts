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

export enum ExtractionMethod {
  OCR = 'OCR',
  TABLE_EXTRACTION = 'TABLE_EXTRACTION',
  LLM_EXTRACTION = 'LLM_EXTRACTION',
  GEOCODING = 'GEOCODING',
  HEURISTIC = 'HEURISTIC',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
}

export enum ValidationStatus {
  VALID = 'valid',
  SUSPICIOUS = 'suspicious',
  INVALID = 'invalid',
  UNVERIFIABLE = 'unverifiable',
}

@Entity('extracted_asset_fields')
export class ExtractedAssetFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'extracted_asset_id', type: 'uuid' })
  @Index()
  extractedAssetId!: string;

  @ManyToOne(() => ExtractedAssetEntity, (asset) => asset.fields, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'extracted_asset_id' })
  extractedAsset!: ExtractedAssetEntity;

  @Column({ name: 'field_name', type: 'varchar' })
  @Index()
  fieldName!: string;

  @Column({ name: 'normalized_value', type: 'jsonb', nullable: true })
  normalizedValue!: object | null;

  @Column({ name: 'raw_value', type: 'text', nullable: true })
  rawValue!: string | null;

  @Column({ name: 'value_type', type: 'varchar', nullable: true })
  valueType!: string | null;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  @Index()
  confidenceScore!: number | null;

  @Column({
    type: 'enum',
    enum: ExtractionMethod,
    nullable: true,
  })
  extractionMethod!: ExtractionMethod | null;

  @Column({ name: 'is_inferred', type: 'boolean', default: false })
  isInferred!: boolean;

  @Column({ name: 'inference_explanation', type: 'text', nullable: true })
  inferenceExplanation!: string | null;

  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText!: string | null;

  @Column({ name: 'source_page_number', type: 'int', nullable: true })
  sourcePageNumber!: number | null;

  @Column({ name: 'source_bbox', type: 'jsonb', nullable: true })
  sourceBbox!: object | null;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    nullable: true,
  })
  validationStatus!: ValidationStatus | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}