import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CanonicalAssetFieldEntity } from './canonical-asset-field.entity';
import { ExtractedAssetFieldEntity } from './extracted-asset-field.entity';

@Entity('field_evidence')
export class FieldEvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'canonical_field_id', type: 'uuid' })
  @Index()
  canonicalFieldId!: string;

  @ManyToOne(() => CanonicalAssetFieldEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'canonical_field_id' })
  canonicalField!: CanonicalAssetFieldEntity;

  @Column({ name: 'extracted_field_id', type: 'uuid' })
  @Index()
  extractedFieldId!: string;

  @ManyToOne(() => ExtractedAssetFieldEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'extracted_field_id' })
  extractedField!: ExtractedAssetFieldEntity;

  @Column({ name: 'evidence_weight', type: 'decimal', precision: 5, scale: 2, nullable: true })
  evidenceWeight!: number | null;

  @Column({ name: 'evidence_role', type: 'varchar' })
  evidenceRole!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}