import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ValidationFlagEntity, ValidationFlagSeverity } from '../entities/validation-flag.entity';

@Injectable()
export class ValidationFlagRepository {
  constructor(
    @InjectRepository(ValidationFlagEntity)
    private readonly repository: Repository<ValidationFlagEntity>,
  ) {}

  async create(data: Partial<ValidationFlagEntity>): Promise<ValidationFlagEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ValidationFlagEntity | null> {
    return this.repository.findOne({ where: { id } as FindOptionsWhere<ValidationFlagEntity> });
  }

  async findByEntity(entityType: string, entityId: string): Promise<ValidationFlagEntity[]> {
    return this.repository.find({ where: { entityType, entityId } as FindOptionsWhere<ValidationFlagEntity> });
  }

  async findBySeverity(severity: ValidationFlagSeverity): Promise<ValidationFlagEntity[]> {
    return this.repository.find({ where: { severity } as FindOptionsWhere<ValidationFlagEntity> });
  }

  async findByFlagType(flagType: string): Promise<ValidationFlagEntity[]> {
    return this.repository.find({ where: { flagType } as FindOptionsWhere<ValidationFlagEntity> });
  }

  async findAll(options?: { skip?: number; take?: number }): Promise<[ValidationFlagEntity[], number]> {
    return this.repository.findAndCount({
      skip: options?.skip,
      take: options?.take,
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByEntity(entityType: string, entityId: string): Promise<void> {
    await this.repository.delete({ entityType, entityId } as FindOptionsWhere<ValidationFlagEntity>);
  }
}