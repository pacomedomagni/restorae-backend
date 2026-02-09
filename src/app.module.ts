import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
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
import { LoggerModule } from './common/logger/logger.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { SyncModule } from './modules/sync/sync.module';
import { StoriesModule } from './modules/stories/stories.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { CoachMarksModule } from './modules/coach-marks/coach-marks.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EmailModule } from './common/email/email.module';
import { SanitizerModule } from './common/sanitizer/sanitizer.module';
import { TracingModule } from './common/tracing/tracing.module';
import { SentryModule } from './common/sentry/sentry.module';
import { QueueModule } from './common/queue/queue.module';

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
    // Global cache (in-memory by default, configurable via REDIS_URL)
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default
      max: 500, // max items in cache
    }),
    EmailModule,
    LoggerModule,
    PrismaModule,
    HealthModule,
    SanitizerModule,
    TracingModule,
    SentryModule,
    QueueModule,
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
    StoriesModule,
    AchievementsModule,
    CoachMarksModule,
    SessionsModule,
    AnalyticsModule,
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
