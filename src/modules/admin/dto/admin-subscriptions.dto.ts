import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { SubscriptionTier } from '@prisma/client';

export class UpdateTierDto {
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;
}

export class GrantPremiumDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;
}
