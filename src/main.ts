import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggerService } from './common/logger/logger.service';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { MetricsService } from './common/health/metrics.service';

async function bootstrap() {
  // Create app with custom logger
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino logger for NestJS
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Add HTTP logging interceptor
  const metrics = app.get(MetricsService);
  app.useGlobalInterceptors(new HttpLoggingInterceptor(logger, metrics));

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for Swagger UI
  }));

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:19006',
      'http://localhost:8081',
    ],
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Restorae API')
      .setDescription('Backend API for Restorae wellness app')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`🚀 Restorae API running on http://localhost:${port}`, 'Bootstrap');
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`📚 API Docs available at http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

bootstrap();
