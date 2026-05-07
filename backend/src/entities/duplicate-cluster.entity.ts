import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum DuplicateClusterStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('duplicate_clusters')
export class DuplicateClusterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: DuplicateClusterStatus,
    default: DuplicateClusterStatus.PENDING,
  })
  clusterStatus!: DuplicateClusterStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}