import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import type { CreateDocumentDto, UpdateDocumentDto, DocumentResponseDto } from '../dtos';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(@Body() dto: CreateDocumentDto): Promise<DocumentResponseDto> {
    return this.documentsService.create(dto);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<{ documents: DocumentResponseDto[]; total: number }> {
    return this.documentsService.findAll({ skip, take });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DocumentResponseDto | null> {
    return this.documentsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto | null> {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.documentsService.remove(id);
  }
}
