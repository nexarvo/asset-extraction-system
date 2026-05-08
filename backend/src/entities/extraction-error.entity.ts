import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProcessingJobEntity } from './processing-job.entity';

@Entity('extraction_errors')
export class ExtractionErrorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'processing_job_id', type: 'uuid', nullable: true })
  @Index()
  processingJobId!: string | null;

  @ManyToOne(() => ProcessingJobEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'processing_job_id' })
  processingJob!: ProcessingJobEntity | null;

  @Column({ name: 'error_stage', type: 'varchar' })
  errorStage!: string;

  @Column({ name: 'error_code', type: 'varchar' })
  errorCode!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace!: string | null;

  @Column({ type: 'boolean', default: false })
  recoverable!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
