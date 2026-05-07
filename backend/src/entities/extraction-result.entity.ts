import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ExtractionJobEntity } from './extraction-job.entity';
import { ExtractedRecordEntity } from './extracted-record.entity';

@Entity('extraction_results')
export class ExtractionResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_id', type: 'varchar' })
  jobId!: string;

  @ManyToOne(() => ExtractionJobEntity, (job) => job.results, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job!: ExtractionJobEntity;

  @Column({ name: 'source_file', type: 'varchar' })
  sourceFile!: string;

  @Column({ name: 'extraction_strategy', type: 'varchar' })
  extractionStrategy!: string;

  @Column({ type: 'jsonb', name: 'metadata', nullable: true })
  metadata!: object | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ExtractedRecordEntity, (record) => record.extractionResult)
  records!: ExtractedRecordEntity[];
}