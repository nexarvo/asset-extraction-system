import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SessionsService, CreateSessionDto, UpdateSessionDto } from '../services/sessions.service';
import { SessionEntity } from '../entities/session.entity';

class CreateSessionBody implements CreateSessionDto {
  name: string;
  createdBy?: string;
}

class UpdateSessionBody implements UpdateSessionDto {
  name?: string;
  updatedBy?: string;
}

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  async create(@Body() body: CreateSessionBody): Promise<SessionEntity> {
    return this.sessionsService.create(body);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<{ data: SessionEntity[]; total: number }> {
    const [data, total] = await this.sessionsService.findAll(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
    return { data, total };
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<SessionEntity> {
    return this.sessionsService.findById(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSessionBody,
  ): Promise<SessionEntity> {
    return this.sessionsService.update(id, body);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.sessionsService.delete(id);
    return { success: true };
  }
}