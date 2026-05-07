import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLoggerService } from './core/app-logger.service';
import { ExtractionController } from './controllers/extraction.controller';
import { RequestLoggingMiddleware } from './middlewares/request-logging.middleware';
import { ExtractionRepository } from './repositories/extraction.repository';
import { CsvAssetMapperService } from './services/csvAssetMapper.service';
import { CsvExtractionService } from './services/extractCSV';
import { DigitalPdfExtractionService } from './services/extractDigitalPDF';
import { PdfExtractionService } from './services/extractPDF';
import { ScannedPdfExtractionService } from './services/extractScannedPDF';
import { XlsxExtractionService } from './services/extractXLSX';
import { PaddleOcrService } from './services/paddleOCR';
import { XlsxAssetMapperService } from './services/xlsxAssetMapper.service';

@Module({
  imports: [],
  controllers: [AppController, ExtractionController],
  providers: [
    AppService,
    AppLoggerService,
    ExtractionRepository,
    CsvAssetMapperService,
    CsvExtractionService,
    XlsxExtractionService,
    XlsxAssetMapperService,
    PdfExtractionService,
    DigitalPdfExtractionService,
    ScannedPdfExtractionService,
    PaddleOcrService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
