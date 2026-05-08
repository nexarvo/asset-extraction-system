import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLoggerService } from './core/app-logger.service';
import { DatabaseModule } from './core/database/database.module';
import { RequestLoggingMiddleware } from './middlewares/request-logging.middleware';
import { ExtractionModule } from './modules/extraction.module';

@Module({
  imports: [DatabaseModule, ExtractionModule],
  controllers: [AppController],
  providers: [AppService, AppLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
