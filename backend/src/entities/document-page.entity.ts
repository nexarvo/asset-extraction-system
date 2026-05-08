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

@Entity('document_pages')
export class DocumentPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  @Index()
  documentId!: string;

  @ManyToOne(() => DocumentEntity, (doc) => doc.pages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document!: DocumentEntity;

  @Column({ name: 'page_number', type: 'int' })
  pageNumber!: number;

  @Column({ name: 'has_text_layer', type: 'boolean', default: false })
  hasTextLayer!: boolean;

  @Column({ name: 'ocr_required', type: 'boolean', default: false })
  ocrRequired!: boolean;

  @Column({ name: 'detected_layout', type: 'jsonb', nullable: true })
  detectedLayout!: object | null;

  @Column({ name: 'page_classification', type: 'varchar', nullable: true })
  pageClassification!: string | null;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  confidenceScore!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
