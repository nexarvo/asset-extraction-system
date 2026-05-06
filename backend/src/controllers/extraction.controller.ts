import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExtractionRepository } from '../repositories/extraction.repository';
import { CsvExtractionService } from '../services/extractCSV';
import { PdfExtractionService } from '../services/extractPDF';
import { XlsxExtractionService } from '../services/extractXLSX';
import { AssetFileInput, StoredExtraction } from '../utils/extraction.types';

interface ExtractionRequestDto {
  readonly filename: string;
  readonly contentBase64: string;
  readonly mimeType?: string;
}

@Controller('extractions')
export class ExtractionController {
  constructor(
    private readonly csvExtractionService: CsvExtractionService,
    private readonly xlsxExtractionService: XlsxExtractionService,
    private readonly pdfExtractionService: PdfExtractionService,
    private readonly extractionRepository: ExtractionRepository,
  ) {}

  @Post('csv')
  async extractCsv(@Body() body: ExtractionRequestDto): Promise<StoredExtraction> {
    const result = await this.csvExtractionService.extractDataFromCsv(this.toFileInput(body));
    return this.extractionRepository.save(result);
  }

  @Post('xlsx')
  async extractXlsx(@Body() body: ExtractionRequestDto): Promise<StoredExtraction> {
    const result = await this.xlsxExtractionService.extractDataFromXlsx(this.toFileInput(body));
    return this.extractionRepository.save(result);
  }

  @Post('pdf')
  async extractPdf(@Body() body: ExtractionRequestDto): Promise<StoredExtraction> {
    const result = await this.pdfExtractionService.extractDataFromPdf(this.toFileInput(body));
    return this.extractionRepository.save(result);
  }

  @Get()
  async listExtractions(): Promise<StoredExtraction[]> {
    return this.extractionRepository.findAll();
  }

  @Get(':id')
  async getExtraction(@Param('id') id: string): Promise<StoredExtraction | undefined> {
    return this.extractionRepository.findById(id);
  }

  private toFileInput(body: ExtractionRequestDto): AssetFileInput {
    return {
      filename: body.filename,
      mimeType: body.mimeType,
      buffer: Buffer.from(body.contentBase64, 'base64'),
    };
  }
}
