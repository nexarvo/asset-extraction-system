import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProcessingJobEntity } from './processing-job.entity';
import { DocumentPageEntity } from './document-page.entity';
import { ExtractedAssetEntity } from './extracted-asset.entity';

export enum DocumentIngestionStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'original_file_name', type: 'varchar' })
  originalFileName!: string;

  @Column({ name: 'storage_key', type: 'varchar' })
  storageKey!: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize!: number | null;

  @Column({ name: 'checksum_sha256', type: 'varchar', nullable: true })
  @Index()
  checksumSha256!: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @Column({ name: 'upload_source', type: 'varchar', nullable: true })
  uploadSource!: string | null;

  @Column({
    type: 'enum',
    enum: DocumentIngestionStatus,
    default: DocumentIngestionStatus.UPLOADED,
  })
  @Index()
  ingestionStatus!: DocumentIngestionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ProcessingJobEntity, (job) => job.document)
  processingJobs!: ProcessingJobEntity[];

  @OneToMany(() => DocumentPageEntity, (page) => page.document)
  pages!: DocumentPageEntity[];

  @OneToMany(() => ExtractedAssetEntity, (asset) => asset.document)
  extractedAssets!: ExtractedAssetEntity[];
}