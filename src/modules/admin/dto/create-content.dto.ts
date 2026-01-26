import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, ContentStatus } from '@prisma/client';

export class CreateContentDto {
  @ApiProperty({ enum: ContentType, example: 'BREATHING' })
  @IsEnum(ContentType)
  type: ContentType;

  @ApiProperty({ example: 'box-breathing' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Box Breathing' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'A calming breathing technique' })
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

  @ApiPropertyOptional({ enum: ContentStatus, example: 'DRAFT' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}
