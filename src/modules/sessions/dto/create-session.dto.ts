import { IsString, IsEnum, IsOptional, IsArray, IsNotEmpty, MaxLength, ValidateNested, IsNumber } from 'class-validator';
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
  @IsNotEmpty()
  @MaxLength(50)
  activityType: string;

  @ApiProperty({ description: 'ID of the activity' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  activityId: string;

  @ApiProperty({ description: 'Name of the activity' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
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
  @MaxLength(100)
  ritualId?: string;

  @ApiPropertyOptional({ description: 'Preset ritual slug (for RITUAL mode)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ritualSlug?: string;

  @ApiPropertyOptional({ description: 'SOS preset ID (for SOS mode)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sosPresetId?: string;

  @ApiProperty({ type: [SessionActivityDto], description: 'Activities in this session' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionActivityDto)
  activities: SessionActivityDto[];
}
