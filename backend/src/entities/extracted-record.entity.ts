import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExtractionResultEntity } from './extraction-result.entity';

@Entity('extracted_records')
export class ExtractedRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'extraction_result_id', type: 'varchar' })
  @Index()
  extractionResultId!: string;

  @ManyToOne(() => ExtractionResultEntity, (result) => result.records, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'extraction_result_id' })
  extractionResult!: ExtractionResultEntity;

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber!: number | null;

  @Column({ name: 'block_type', type: 'varchar', nullable: true })
  blockType!: string | null;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  @Index()
  confidenceScore!: number | null;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText!: string | null;

  @Column({ name: 'structured_data', type: 'jsonb', nullable: true })
  structuredData!: object | null;

  @Column({ name: 'provenance', type: 'jsonb', nullable: true })
  provenance!: object | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}