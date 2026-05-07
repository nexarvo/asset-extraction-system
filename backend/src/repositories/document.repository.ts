import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindOptionsRelations } from 'typeorm';
import { DocumentEntity, DocumentIngestionStatus } from '../entities/document.entity';

@Injectable()
export class DocumentRepository {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly repository: Repository<DocumentEntity>,
  ) {}

  async create(data: Partial<DocumentEntity>): Promise<DocumentEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<DocumentEntity> });
  }

  async findByIds(ids: string[]): Promise<DocumentEntity[]> {
    if (ids.length === 0) return [];
    return this.repository.findBy(ids.map((id) => ({ id } as FindOptionsWhere<DocumentEntity>)));
  }

  async findByChecksum(checksum: string): Promise<DocumentEntity | null> {
    return this.repository.findOne({ where: { checksumSha256: checksum } as FindOptionsWhere<DocumentEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[DocumentEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  async findByStatus(status: DocumentIngestionStatus): Promise<DocumentEntity[]> {
    return this.repository.find({ where: { ingestionStatus: status } as FindOptionsWhere<DocumentEntity> });
  }

  async updateStatus(id: string, status: DocumentIngestionStatus): Promise<void> {
    await this.repository.update(id, { ingestionStatus: status });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}