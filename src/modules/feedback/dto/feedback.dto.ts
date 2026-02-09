import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, MaxLength } from 'class-validator';
import { FeedbackType, FeedbackStatus } from '@prisma/client';

export class SubmitFeedbackDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: any; // Prisma InputJsonValue
}

export class UpdateFeedbackStatusDto {
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
