import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';

export class UpdateContentDto {
  @ApiPropertyOptional({ example: 'Box Breathing Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'An updated calming breathing technique' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: { steps: [], duration: 300 } })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ example: 'relaxation' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: ['calm', 'stress'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'anxiety relief' })
  @IsOptional()
  @IsString()
  bestFor?: string;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ example: 'breathing-icon' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ enum: ContentStatus, example: 'PUBLISHED' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
