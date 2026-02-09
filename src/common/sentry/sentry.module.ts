/**
 * Sentry Integration Module
 * 
 * Provides error tracking and performance monitoring via Sentry.
 */
import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';

@Global()
@Module({
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule implements OnModuleInit {
  constructor(
    private configService: ConfigService,
    private sentryService: SentryService,
  ) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const environment = this.configService.get<string>('NODE_ENV', 'development');
    
    if (dsn) {
      this.sentryService.init({
        dsn,
        environment,
        release: process.env.npm_package_version,
        tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      });
    }
  }
}
