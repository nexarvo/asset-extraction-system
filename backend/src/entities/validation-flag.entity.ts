import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ValidationFlagSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('validation_flags')
export class ValidationFlagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'entity_type', type: 'varchar' })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  @Index()
  entityId!: string;

  @Column({ name: 'flag_type', type: 'varchar' })
  flagType!: string;

  @Column({
    type: 'enum',
    enum: ValidationFlagSeverity,
  })
  severity!: ValidationFlagSeverity;

  @Column({ type: 'text', nullable: true })
  explanation!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
