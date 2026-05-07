import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { DocumentPageEntity } from '../entities/document-page.entity';

@Injectable()
export class DocumentPageRepository {
  constructor(
    @InjectRepository(DocumentPageEntity)
    private readonly repository: Repository<DocumentPageEntity>,
  ) {}

  async create(data: Partial<DocumentPageEntity>): Promise<DocumentPageEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<DocumentPageEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<DocumentPageEntity> });
  }

  async findByDocumentId(documentId: string): Promise<DocumentPageEntity[]> {
    return this.repository.find({ where: { documentId } as FindOptionsWhere<DocumentPageEntity>, order: { pageNumber: 'ASC' } });
  }

  async findByDocumentAndPage(documentId: string, pageNumber: number): Promise<DocumentPageEntity | null> {
    return this.repository.findOne({ where: { documentId, pageNumber } as FindOptionsWhere<DocumentPageEntity> });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.repository.delete({ documentId } as FindOptionsWhere<DocumentPageEntity>);
  }
}