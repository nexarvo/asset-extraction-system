import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { DocumentEntity } from './document.entity';
import { DocumentPageEntity } from './document-page.entity';
import { ExtractedAssetFieldEntity } from './extracted-asset-field.entity';
import { ProcessingJobEntity } from './processing-job.entity';

export enum ExtractedAssetReviewStatus {
  PENDING = 'pending',
  AUTO_APPROVED = 'auto_approved',
  REQUIRES_REVIEW = 'requires_review',
  REJECTED = 'rejected',
}

@Entity('extracted_assets')
export class ExtractedAssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  @Index()
  documentId!: string;

  @ManyToOne(() => DocumentEntity, (doc) => doc.extractedAssets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document!: DocumentEntity;

  @Column({ name: 'extraction_job_id', type: 'uuid', nullable: true })
  extractionJobId!: string | null;

  @ManyToOne(() => ProcessingJobEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'extraction_job_id' })
  extractionJob!: ProcessingJobEntity | null;

  @Column({ name: 'source_page_id', type: 'uuid', nullable: true })
  sourcePageId!: string | null;

  @ManyToOne(() => DocumentPageEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'source_page_id' })
  sourcePage!: DocumentPageEntity | null;

  @Column({ name: 'extraction_strategy', type: 'varchar', nullable: true })
  extractionStrategy!: string | null;

  @Column({ name: 'extraction_model', type: 'varchar', nullable: true })
  extractionModel!: string | null;

  @Column({ name: 'raw_asset_name', type: 'text', nullable: true })
  rawAssetName!: string | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: object | null;

  @Column({ name: 'overall_confidence', type: 'decimal', precision: 5, scale: 2, nullable: true })
  overallConfidence!: number | null;

  @Column({
    type: 'enum',
    enum: ExtractedAssetReviewStatus,
    default: ExtractedAssetReviewStatus.PENDING,
  })
  @Index()
  reviewStatus!: ExtractedAssetReviewStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ExtractedAssetFieldEntity, (field) => field.extractedAsset)
  fields!: ExtractedAssetFieldEntity[];
}