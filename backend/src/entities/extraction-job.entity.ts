import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ExtractionResultEntity } from './extraction-result.entity';
import { ExtractionErrorEntity } from './extraction-error.entity';

export enum ExtractionJobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('extraction_jobs')
export class ExtractionJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName!: string;

  @Column({ name: 'file_type', type: 'varchar' })
  fileType!: string;

  @Column({
    type: 'enum',
    enum: ExtractionJobStatus,
    default: ExtractionJobStatus.WAITING,
  })
  @Index()
  status!: ExtractionJobStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'error_message', type: 'varchar', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => ExtractionResultEntity, (result) => result.job)
  results!: ExtractionResultEntity[];

  @OneToMany(() => ExtractionErrorEntity, (error) => error.job)
  errors!: ExtractionErrorEntity[];
}