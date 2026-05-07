import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReviewQueueStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESOLVED = 'resolved',
}

@Entity('review_queue')
export class ReviewQueueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'varchar' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  @Index()
  entityId!: string;

  @Column({ name: 'review_reason', type: 'varchar', nullable: true })
  reviewReason!: string | null;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({
    type: 'enum',
    enum: ReviewQueueStatus,
    default: ReviewQueueStatus.PENDING,
  })
  @Index()
  status!: ReviewQueueStatus;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}