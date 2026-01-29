import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SessionMode {
  SINGLE = 'SINGLE',
  RITUAL = 'RITUAL',
  SOS = 'SOS',
}

export class SessionActivityDto {
  @ApiProperty({ description: 'Type of activity (breathing, grounding, etc.)' })
  @IsString()
  activityType: string;

  @ApiProperty({ description: 'ID of the activity' })
  @IsString()
  activityId: string;

  @ApiProperty({ description: 'Name of the activity' })
  @IsString()
  activityName: string;

  @ApiProperty({ description: 'Order in the session queue' })
  @IsNumber()
  order: number;
}

export class CreateSessionDto {
  @ApiProperty({ enum: SessionMode, description: 'Session mode' })
  @IsEnum(SessionMode)
  mode: SessionMode;

  @ApiPropertyOptional({ description: 'Custom ritual ID (for RITUAL mode)' })
  @IsOptional()
  @IsString()
  ritualId?: string;

  @ApiPropertyOptional({ description: 'Preset ritual slug (for RITUAL mode)' })
  @IsOptional()
  @IsString()
  ritualSlug?: string;

  @ApiPropertyOptional({ description: 'SOS preset ID (for SOS mode)' })
  @IsOptional()
  @IsString()
  sosPresetId?: string;

  @ApiProperty({ type: [SessionActivityDto], description: 'Activities in this session' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionActivityDto)
  activities: SessionActivityDto[];
}
