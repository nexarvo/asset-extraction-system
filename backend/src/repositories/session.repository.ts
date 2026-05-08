import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from '../entities/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repository: Repository<SessionEntity>,
  ) {}

  async create(data: Partial<SessionEntity>): Promise<SessionEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<SessionEntity | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['documents'],
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
  }): Promise<[SessionEntity[], number]> {
    return this.repository.findAndCount({
      relations: ['documents'],
      order: { createdAt: 'DESC' },
      skip: options?.skip,
      take: options?.take,
    });
  }

  async update(id: string, data: Partial<SessionEntity>): Promise<void> {
    const allowedFields = ['name', 'updatedBy'];
    const updateData: Partial<SessionEntity> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;
    
    await this.repository.update(id, updateData as any);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}