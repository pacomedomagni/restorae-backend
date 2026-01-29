-- CreateEnum
CREATE TYPE "StoryCategory" AS ENUM ('NATURE', 'TRAVEL', 'FANTASY', 'MEDITATION', 'SOUNDSCAPES', 'CLASSICS');

-- CreateEnum
CREATE TYPE "StoryMood" AS ENUM ('CALM', 'DREAMY', 'COZY', 'MAGICAL');

-- CreateEnum
CREATE TYPE "AchievementCategory" AS ENUM ('CONSISTENCY', 'SESSION', 'MINDFULNESS', 'EXPLORATION', 'MASTERY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "AchievementTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('BREATHING', 'GROUNDING', 'RESET', 'FOCUS', 'JOURNAL', 'MOOD', 'STORY', 'RITUAL', 'SOS');

-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE 'BEDTIME_STORY';

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityId" TEXT,
    "duration" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedtimeStory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "narrator" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "artworkUrl" TEXT,
    "category" "StoryCategory" NOT NULL,
    "tags" TEXT[],
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "mood" "StoryMood" NOT NULL DEFAULT 'CALM',
    "backgroundSound" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "listenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BedtimeStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedtimeStoryLocale" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedtimeStoryLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" "AchievementCategory" NOT NULL,
    "tier" "AchievementTier" NOT NULL DEFAULT 'BRONZE',
    "requirement" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementLocale" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentXp" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMark" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "screen" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'center',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMarkLocale" (
    "id" TEXT NOT NULL,
    "coachMarkId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachMarkLocale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_category_idx" ON "ActivityLog"("category");

-- CreateIndex
CREATE INDEX "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_category_idx" ON "ActivityLog"("userId", "category");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_timestamp_idx" ON "ActivityLog"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BedtimeStory_slug_key" ON "BedtimeStory"("slug");

-- CreateIndex
CREATE INDEX "BedtimeStory_category_status_order_idx" ON "BedtimeStory"("category", "status", "order");

-- CreateIndex
CREATE INDEX "BedtimeStory_isPremium_status_idx" ON "BedtimeStory"("isPremium", "status");

-- CreateIndex
CREATE INDEX "BedtimeStory_mood_idx" ON "BedtimeStory"("mood");

-- CreateIndex
CREATE INDEX "BedtimeStory_slug_idx" ON "BedtimeStory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BedtimeStoryLocale_storyId_locale_key" ON "BedtimeStoryLocale"("storyId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");

-- CreateIndex
CREATE INDEX "Achievement_tier_idx" ON "Achievement"("tier");

-- CreateIndex
CREATE INDEX "Achievement_isActive_idx" ON "Achievement"("isActive");

-- CreateIndex
CREATE INDEX "Achievement_key_idx" ON "Achievement"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementLocale_achievementId_locale_key" ON "AchievementLocale"("achievementId", "locale");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_unlockedAt_idx" ON "UserAchievement"("unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLevel_userId_key" ON "UserLevel"("userId");

-- CreateIndex
CREATE INDEX "UserLevel_level_idx" ON "UserLevel"("level");

-- CreateIndex
CREATE INDEX "UserLevel_currentStreak_idx" ON "UserLevel"("currentStreak");

-- CreateIndex
CREATE UNIQUE INDEX "CoachMark_key_key" ON "CoachMark"("key");

-- CreateIndex
CREATE INDEX "CoachMark_screen_isActive_idx" ON "CoachMark"("screen", "isActive");

-- CreateIndex
CREATE INDEX "CoachMark_key_idx" ON "CoachMark"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CoachMarkLocale_coachMarkId_locale_key" ON "CoachMarkLocale"("coachMarkId", "locale");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedtimeStoryLocale" ADD CONSTRAINT "BedtimeStoryLocale_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "BedtimeStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementLocale" ADD CONSTRAINT "AchievementLocale_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMarkLocale" ADD CONSTRAINT "CoachMarkLocale_coachMarkId_fkey" FOREIGN KEY ("coachMarkId") REFERENCES "CoachMark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
