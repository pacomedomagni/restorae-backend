import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ContentStatus, StoryMood, StoryCategory } from '@prisma/client';

export class StoryLocaleDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  locale: string;

  @ApiProperty({ example: 'The Moonlit Meadow' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'A peaceful journey through night gardens' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ example: 'A beautiful story about...' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateStoryDto {
  @ApiProperty({ example: 'moonlit-meadow' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'The Moonlit Meadow' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'A peaceful journey through night gardens' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ example: 'Drift into peaceful slumber as you wander...' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Sarah Williams' })
  @IsString()
  narrator: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  duration: number;

  @ApiProperty({ example: 'https://cdn.example.com/stories/moonlit.mp3' })
  @IsString()
  audioUrl: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/artwork/moonlit.jpg' })
  @IsOptional()
  @IsString()
  artworkUrl?: string;

  @ApiProperty({ enum: StoryCategory, example: 'NATURE' })
  @IsEnum(StoryCategory)
  category: StoryCategory;

  @ApiPropertyOptional({ type: [String], example: ['nature', 'peaceful'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: StoryMood, example: 'CALM' })
  @IsOptional()
  @IsEnum(StoryMood)
  mood?: StoryMood;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional({ example: 'ambient-rain-001' })
  @IsOptional()
  @IsString()
  backgroundSound?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ enum: ContentStatus, example: 'DRAFT' })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ type: [StoryLocaleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoryLocaleDto)
  locales?: StoryLocaleDto[];
}

export class UpdateStoryDto extends PartialType(CreateStoryDto) {}
