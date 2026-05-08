import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DocumentEntity } from './document.entity';

export enum ProcessingJobType {
  OCR = 'OCR',
  DOCUMENT_UNDERSTANDING = 'DOCUMENT_UNDERSTANDING',
  EXTRACTION = 'EXTRACTION',
  RECONCILIATION = 'RECONCILIATION',
  VALIDATION = 'VALIDATION',
  GEOCODING = 'GEOCODING',
  CONFIDENCE_SCORING = 'CONFIDENCE_SCORING',
}

export enum ProcessingJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('processing_jobs')
export class ProcessingJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  @Index()
  documentId!: string | null;

  @ManyToOne(() => DocumentEntity, (doc) => doc.processingJobs, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'document_id' })
  document!: DocumentEntity;

  @Column({
    type: 'enum',
    enum: ProcessingJobType,
  })
  jobType!: ProcessingJobType;

  @Column({
    type: 'enum',
    enum: ProcessingJobStatus,
    default: ProcessingJobStatus.QUEUED,
  })
  @Index()
  status!: ProcessingJobStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'error_summary', type: 'text', nullable: true })
  errorSummary!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
