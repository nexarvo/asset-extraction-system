import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadedFileValidationPipe } from '../pipes/file-validation.pipe';
import { MultiFileValidationPipe } from '../pipes/multi-file-validation.pipe';
import { ExtractionRepository } from '../repositories/extraction.repository';
import { CsvExtractionService } from '../services/extractCSV';
import { JobDispatcherService } from '../services/job-dispatcher.service';
import { PdfExtractionService } from '../services/extractPDF';
import { XlsxExtractionService } from '../services/extractXLSX';
import { SupportedFileType, QueuedJobResponse, JobStatusResponse } from '../utils/extraction.types';
import type {
  AssetFileInput,
  StoredExtraction,
} from '../utils/extraction.types';

const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

const FILE_INTERCEPTOR_OPTIONS = {
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
};

const MULTI_FILE_INTERCEPTOR_OPTIONS = {
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 10,
  },
};

const CSV_UPLOAD_PIPE = new UploadedFileValidationPipe({
  allowedFileTypes: [SupportedFileType.Csv],
  allowedMimeTypes: [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
  ],
});

const XLSX_UPLOAD_PIPE = new UploadedFileValidationPipe({
  allowedFileTypes: [SupportedFileType.Xls, SupportedFileType.Xlsx],
  allowedMimeTypes: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  fallbackMimeTypes: ['text/plain'],
});

const PDF_UPLOAD_PIPE = new UploadedFileValidationPipe({
  allowedFileTypes: [SupportedFileType.Pdf],
  allowedMimeTypes: ['application/pdf', 'application/octet-stream'],
  fallbackMimeTypes: ['text/plain'],
});

const EXTRACT_UPLOAD_PIPE = new MultiFileValidationPipe({
  allowedFileTypes: [
    SupportedFileType.Csv,
    SupportedFileType.Xls,
    SupportedFileType.Xlsx,
    SupportedFileType.Pdf,
  ],
  allowedMimeTypes: [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    'application/pdf',
  ],
  fallbackMimeTypes: ['text/plain'],
});

@Controller('extractions')
export class ExtractionController {
  constructor(
    private readonly csvExtractionService: CsvExtractionService,
    private readonly xlsxExtractionService: XlsxExtractionService,
    private readonly pdfExtractionService: PdfExtractionService,
    private readonly extractionRepository: ExtractionRepository,
    private readonly jobDispatcherService: JobDispatcherService,
  ) {}

  @Post('csv')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async extractCsv(
    @UploadedFile(CSV_UPLOAD_PIPE) file: AssetFileInput,
  ): Promise<StoredExtraction> {
    const result = await this.csvExtractionService.extractDataFromCsv(file);
    const stored = await this.extractionRepository.save(result);
    return stored;
  }

  @Post('xlsx')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async extractXlsx(
    @UploadedFile(XLSX_UPLOAD_PIPE) file: AssetFileInput,
  ): Promise<StoredExtraction> {
    const result = await this.xlsxExtractionService.extractDataFromXlsx(file);
    const stored = await this.extractionRepository.save(result);
    return stored;
  }

  @Post('pdf')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async extractPdf(
    @UploadedFile(PDF_UPLOAD_PIPE) file: AssetFileInput,
  ): Promise<StoredExtraction> {
    const result = await this.pdfExtractionService.extractDataFromPdf(file);
    const stored = await this.extractionRepository.save(result);
    return stored;
  }

  @Post('extract')
  @UseInterceptors(FilesInterceptor('files', 10, MULTI_FILE_INTERCEPTOR_OPTIONS))
  async extractMultiFile(
    @UploadedFiles(EXTRACT_UPLOAD_PIPE) files: AssetFileInput[],
  ): Promise<{ jobs: QueuedJobResponse[] }> {
    const fileData = files.map((f) => ({
      filename: f.filename,
      buffer: f.buffer,
    }));

    const jobs = await this.jobDispatcherService.dispatchFiles(fileData);
    return { jobs };
  }

  @Get('jobs/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<JobStatusResponse | { error: string }> {
    const status = await this.jobDispatcherService.getJobStatus(jobId);

    if (!status) {
      return { error: 'Job not found' };
    }

    return status;
  }

  @Get()
  async listExtractions(): Promise<StoredExtraction[]> {
    return this.extractionRepository.findAll();
  }

  @Get(':id')
  async getExtraction(
    @Param('id') id: string,
  ): Promise<StoredExtraction | undefined> {
    return this.extractionRepository.findById(id);
  }
}
