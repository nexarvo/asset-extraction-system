import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { DuplicateClusterEntity, DuplicateClusterStatus } from '../entities/duplicate-cluster.entity';

@Injectable()
export class DuplicateClusterRepository {
  constructor(
    @InjectRepository(DuplicateClusterEntity)
    private readonly repository: Repository<DuplicateClusterEntity>,
  ) {}

  async create(data: Partial<DuplicateClusterEntity>): Promise<DuplicateClusterEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<DuplicateClusterEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<DuplicateClusterEntity> });
  }

  async findByStatus(status: DuplicateClusterStatus): Promise<DuplicateClusterEntity[]> {
    return this.repository.find({ where: { clusterStatus: status } as FindOptionsWhere<DuplicateClusterEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[DuplicateClusterEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: DuplicateClusterStatus): Promise<void> {
    await this.repository.update(id, { clusterStatus: status });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}