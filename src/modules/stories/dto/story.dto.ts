import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ContentStatus, StoryMood, StoryCategory } from '@prisma/client';

export class StoryLocaleDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  @MaxLength(10)
  locale: string;

  @ApiProperty({ example: 'The Moonlit Meadow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({ example: 'A peaceful journey through night gardens' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  subtitle?: string;

  @ApiPropertyOptional({ example: 'A beautiful story about...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreateStoryDto {
  @ApiProperty({ example: 'moonlit-meadow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiProperty({ example: 'The Moonlit Meadow' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({ example: 'A peaceful journey through night gardens' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  subtitle?: string;

  @ApiProperty({ example: 'Drift into peaceful slumber as you wander...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @ApiProperty({ example: 'Sarah Williams' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  narrator: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  duration: number;

  @ApiProperty({ example: 'https://cdn.example.com/stories/moonlit.mp3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  audioUrl: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/artwork/moonlit.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  artworkUrl?: string;

  @ApiProperty({ enum: StoryCategory, example: 'NATURE' })
  @IsEnum(StoryCategory)
  category: StoryCategory;

  @ApiPropertyOptional({ type: [String], example: ['nature', 'peaceful'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
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
  @MaxLength(100)
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
