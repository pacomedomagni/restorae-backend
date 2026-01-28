import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContentModule } from './modules/content/content.module';
import { MoodModule } from './modules/mood/mood.module';
import { JournalModule } from './modules/journal/journal.module';
import { RitualsModule } from './modules/rituals/rituals.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { HealthModule } from './common/health/health.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    // Rate limiting - 100 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ContentModule,
    MoodModule,
    JournalModule,
    RitualsModule,
    SubscriptionsModule,
    NotificationsModule,
    AdminModule,
    FeedbackModule,
    ActivitiesModule,
    SyncModule,
  ],
  providers: [
    // Global exception filter for consistent error responses
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
