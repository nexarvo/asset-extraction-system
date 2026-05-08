import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepository } from '../repositories/session.repository';
import { SessionEntity } from '../entities/session.entity';

export interface CreateSessionDto {
  name: string;
  createdBy?: string;
}

export interface UpdateSessionDto {
  name?: string;
  updatedBy?: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async create(dto: CreateSessionDto): Promise<SessionEntity> {
    return this.sessionRepository.create({
      name: dto.name,
      createdBy: dto.createdBy || null,
      updatedBy: dto.createdBy || null,
    });
  }

  async findById(id: string): Promise<SessionEntity> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return session;
  }

  async findAll(skip = 0, take = 50): Promise<[SessionEntity[], number]> {
    return this.sessionRepository.findAll({ skip, take });
  }

  async update(id: string, dto: UpdateSessionDto): Promise<SessionEntity> {
    await this.sessionRepository.update(id, {
      name: dto.name,
      updatedBy: dto.updatedBy || null,
    });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    await this.sessionRepository.delete(id);
  }
}