import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ReviewQueueEntity, ReviewQueueStatus } from '../entities/review-queue.entity';

@Injectable()
export class ReviewQueueRepository {
  constructor(
    @InjectRepository(ReviewQueueEntity)
    private readonly repository: Repository<ReviewQueueEntity>,
  ) {}

  async create(data: Partial<ReviewQueueEntity>): Promise<ReviewQueueEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ReviewQueueEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<ReviewQueueEntity> });
  }

  async findByEntity(entityType: string, entityId: string): Promise<ReviewQueueEntity | null> {
    return this.repository.findOne({ where: { entityType, entityId } as FindOptionsWhere<ReviewQueueEntity> });
  }

  async findByStatus(status: ReviewQueueStatus): Promise<ReviewQueueEntity[]> {
    return this.repository.find({ where: { status } as FindOptionsWhere<ReviewQueueEntity>, order: { priority: 'DESC', createdAt: 'ASC' } });
  }

  async findByAssignedTo(userId: string): Promise<ReviewQueueEntity[]> {
    return this.repository.find({ where: { assignedTo: userId } as FindOptionsWhere<ReviewQueueEntity> });
  }

  async findPending(limit: number = 10): Promise<ReviewQueueEntity[]> {
    return this.repository.find({
      where: { status: ReviewQueueStatus.PENDING } as FindOptionsWhere<ReviewQueueEntity>,
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: limit,
    });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[ReviewQueueEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async updateStatus(id: string, status: ReviewQueueStatus, resolvedBy?: string, resolutionNotes?: string): Promise<void> {
    await this.repository.update(id, {
      status,
      resolvedBy: resolvedBy || null,
      resolvedAt: resolvedBy ? new Date() : null,
      resolutionNotes: resolutionNotes || null,
    });
  }

  async assignTo(id: string, userId: string): Promise<void> {
    await this.repository.update(id, { assignedTo: userId, status: ReviewQueueStatus.IN_REVIEW });
  }

  async updatePriority(id: string, priority: number): Promise<void> {
    await this.repository.update(id, { priority });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}