import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsObject, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ActivityCategory {
  BREATHING = 'BREATHING',
  GROUNDING = 'GROUNDING',
  RESET = 'RESET',
  FOCUS = 'FOCUS',
  JOURNAL = 'JOURNAL',
  MOOD = 'MOOD',
  STORY = 'STORY',
  RITUAL = 'RITUAL',
  SOS = 'SOS',
}

export class CreateActivityLogDto {
  @ApiProperty({ enum: ActivityCategory, description: 'Category of the activity' })
  @IsEnum(ActivityCategory)
  category: ActivityCategory;

  @ApiProperty({ description: 'Specific type/name of the activity' })
  @IsString()
  activityType: string;

  @ApiPropertyOptional({ description: 'ID of the content item if applicable' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiProperty({ description: 'Duration in seconds' })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Whether the activity was completed' })
  @IsBoolean()
  completed: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata about the activity' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'When the activity occurred' })
  @IsDateString()
  timestamp: string;
}

export class CreateActivityLogBatchDto {
  @ApiProperty({ type: [CreateActivityLogDto] })
  activities: CreateActivityLogDto[];
}
