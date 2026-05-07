import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExtractionJobEntity } from './extraction-job.entity';

@Entity('extraction_errors')
export class ExtractionErrorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_id', type: 'varchar' })
  @Index()
  jobId!: string;

  @ManyToOne(() => ExtractionJobEntity, (job) => job.errors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job!: ExtractionJobEntity;

  @Column({ name: 'error_code', type: 'varchar' })
  errorCode!: string;

  @Column({ type: 'varchar' })
  message!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}