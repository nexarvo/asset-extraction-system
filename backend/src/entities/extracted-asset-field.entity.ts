import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

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

export enum ExtractedAssetReviewStatus {
  PENDING = 'pending',
  AUTO_APPROVED = 'auto_approved',
  REQUIRES_REVIEW = 'requires_review',
  REJECTED = 'rejected',
}

@Entity('extracted_asset_fields')
export class ExtractedAssetFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  @Index()
  documentId!: string;

  @Column({ name: 'extraction_job_id', type: 'uuid', nullable: true })
  extractionJobId!: string | null;

  @Column({ name: 'source_page_id', type: 'uuid', nullable: true })
  sourcePageId!: string | null;

  @Column({ name: 'extraction_strategy', type: 'varchar', nullable: true })
  extractionStrategy!: string | null;

  @Column({ name: 'extraction_model', type: 'varchar', nullable: true })
  extractionModel!: string | null;

  @Column({ name: 'raw_asset_name', type: 'text', nullable: true })
  rawAssetName!: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: object | null;

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
    enum: ExtractedAssetReviewStatus,
    default: ExtractedAssetReviewStatus.PENDING,
  })
  @Index()
  reviewStatus!: ExtractedAssetReviewStatus;

  @Column({ name: 'field_name', type: 'varchar' })
  @Index()
  fieldName!: string;

  @Column({ name: 'normalized_value', type: 'jsonb', nullable: true })
  normalizedValue!: object | null;

  @Column({ name: 'raw_value', type: 'text', nullable: true })
  rawValue!: string | null;

  @Column({ name: 'value_type', type: 'varchar', nullable: true })
  valueType!: string | null;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
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

  @Column({ name: 'source_row_index', type: 'int', nullable: true })
  @Index()
  sourceRowIndex!: number | null;

  @Column({ name: 'source_sheet_name', type: 'varchar', nullable: true })
  sourceSheetName!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
