import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/http-exception.filter';
import { AppLoggerService } from './core/app-logger.service';

async function bootstrap() {
  const logger = new AppLoggerService();
  const app = await NestFactory.create(AppModule, { logger });

  app.useGlobalFilters(new HttpExceptionFilter(logger));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
