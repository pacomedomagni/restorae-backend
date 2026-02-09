import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ==================== AUTH RESPONSES ====================

export class PreferencesResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiProperty({ example: 'system', enum: ['light', 'dark', 'system'] })
  theme: string;

  @ApiProperty({ example: true })
  soundsEnabled: boolean;

  @ApiProperty({ example: true })
  hapticsEnabled: boolean;

  @ApiProperty({ example: 'NONE', enum: ['BIOMETRIC', 'PIN', 'BOTH', 'NONE'] })
  lockMethod: string;

  @ApiProperty({ example: true })
  lockOnBackground: boolean;

  @ApiProperty({ example: 0 })
  lockTimeout: number;

  @ApiProperty({ example: false })
  quietHoursEnabled: boolean;

  @ApiPropertyOptional({ example: '22:00' })
  quietHoursStart: string | null;

  @ApiPropertyOptional({ example: '07:00' })
  quietHoursEnd: string | null;
}

export class SubscriptionResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiProperty({ example: 'FREE', enum: ['FREE', 'PREMIUM', 'LIFETIME'] })
  tier: string;

  @ApiProperty({ example: false })
  isTrialing: boolean;

  @ApiPropertyOptional()
  trialStartedAt: Date | null;

  @ApiPropertyOptional()
  trialEndsAt: Date | null;

  @ApiPropertyOptional()
  currentPeriodStart: Date | null;

  @ApiPropertyOptional()
  currentPeriodEnd: Date | null;

  @ApiPropertyOptional()
  cancelledAt: Date | null;

  @ApiPropertyOptional({ example: 'ios' })
  platform: string | null;

  @ApiPropertyOptional({ example: 'com.restorae.premium.monthly' })
  productId: string | null;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  email: string | null;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiPropertyOptional({ example: 'Jane' })
  name: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl: string | null;

  @ApiProperty({ example: 'UTC' })
  timezone: string;

  @ApiProperty({ example: 'en' })
  locale: string;

  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN', 'ANALYST', 'SUPPORT'] })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  onboardingCompleted: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  preferences: PreferencesResponseDto | null;

  @ApiPropertyOptional()
  subscription: SubscriptionResponseDto | null;
}

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;

  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2g...' })
  refreshToken: string;

  @ApiProperty()
  user: UserProfileResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;
}

// ==================== MOOD RESPONSES ====================

export class MoodEntryResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiProperty({ example: 'clx1abc2d0000...' })
  userId: string;

  @ApiProperty({ example: 'CALM', enum: ['ENERGIZED', 'CALM', 'ANXIOUS', 'LOW', 'GOOD', 'TOUGH'] })
  mood: string;

  @ApiPropertyOptional({ example: 'Feeling relaxed after meditation' })
  note: string | null;

  @ApiProperty({ example: 'MANUAL', enum: ['MORNING', 'MIDDAY', 'EVENING', 'MANUAL'] })
  context: string;

  @ApiProperty({ example: ['exercise', 'sleep'], type: [String] })
  factors: string[];

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  createdAt: Date;
}

export class MoodStatsResponseDto {
  @ApiProperty({ example: 42 })
  totalEntries: number;

  @ApiProperty({ example: 7 })
  currentStreak: number;

  @ApiProperty({ example: { CALM: 15, GOOD: 12, ANXIOUS: 8, LOW: 4, ENERGIZED: 3 } })
  moodDistribution: Record<string, number>;

  @ApiProperty({ example: ['exercise', 'sleep', 'meditation'] })
  topFactors: string[];
}

export class WeeklyGoalResponseDto {
  @ApiProperty({ example: 5 })
  targetDays: number;

  @ApiProperty({ example: 3 })
  completedDays: number;

  @ApiProperty({ example: false })
  isComplete: boolean;
}

// ==================== JOURNAL RESPONSES ====================

export class JournalEntryResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiProperty({ example: 'clx1abc2d0000...' })
  userId: string;

  @ApiPropertyOptional({ example: 'Morning reflection' })
  title: string | null;

  @ApiProperty({ example: 'Today I felt grateful for...' })
  content: string;

  @ApiProperty({ example: false })
  isEncrypted: boolean;

  @ApiProperty({ example: false })
  isLocked: boolean;

  @ApiPropertyOptional({ example: 'gratitude-prompt-1' })
  promptId: string | null;

  @ApiPropertyOptional({ example: 'clx1abc2d0000...' })
  moodEntryId: string | null;

  @ApiProperty({ example: ['gratitude', 'morning'], type: [String] })
  tags: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ==================== SUBSCRIPTION RESPONSES ====================

export class FeatureAccessResponseDto {
  @ApiProperty({ example: true })
  hasAccess: boolean;

  @ApiProperty({ example: 'PREMIUM', enum: ['FREE', 'PREMIUM', 'LIFETIME'] })
  tier: string;

  @ApiPropertyOptional({ example: 'Premium subscription required' })
  reason?: string;
}

// ==================== DEVICE RESPONSES ====================

export class DeviceResponseDto {
  @ApiProperty({ example: 'clx1abc2d0000...' })
  id: string;

  @ApiProperty({ example: 'device-uuid-123' })
  deviceId: string;

  @ApiPropertyOptional({ example: 'ios' })
  platform: string | null;

  @ApiPropertyOptional({ example: 'ExponentPushToken[xxx]' })
  pushToken: string | null;

  @ApiProperty()
  createdAt: Date;
}

// ==================== DATA EXPORT ====================

export class DataExportResponseDto {
  @ApiProperty()
  user: UserProfileResponseDto;

  @ApiProperty({ type: [MoodEntryResponseDto] })
  moodEntries: MoodEntryResponseDto[];

  @ApiProperty({ type: [JournalEntryResponseDto] })
  journalEntries: JournalEntryResponseDto[];
}

// ==================== PASSWORD RESET ====================

export class TokenValidResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;
}
