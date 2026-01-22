import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
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
  ],
})
export class AppModule {}
