import { Role, SubscriptionTier, LockMethod } from '@prisma/client';

/**
 * Shape of the user object attached to requests by JwtStrategy.
 * Matches `Omit<User & { preferences, subscription }, 'passwordHash'>`.
 */
export interface UserPayload {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  role: Role;
  isActive: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  appleId: string | null;
  googleId: string | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  preferences: {
    id: string;
    userId: string;
    theme: string;
    soundsEnabled: boolean;
    hapticsEnabled: boolean;
    lockMethod: LockMethod;
    lockOnBackground: boolean;
    lockTimeout: number;
    quietHoursEnabled: boolean;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    updatedAt: Date;
  } | null;
  subscription: {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    isTrialing: boolean;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelledAt: Date | null;
    revenuecatId: string | null;
    platform: string | null;
    productId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

/**
 * Express Request with authenticated user (required — guarded endpoints).
 */
export interface AuthenticatedRequest {
  user: UserPayload;
}

/**
 * Express Request with optional user (OptionalJwtAuth endpoints).
 */
export interface OptionalAuthRequest {
  user?: UserPayload;
}
