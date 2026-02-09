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
import { AchievementCategory, AchievementTier } from '@prisma/client';

export class AchievementLocaleDto {
  @ApiProperty({ example: 'en' })
  @IsString()
  @MaxLength(10)
  locale: string;

  @ApiProperty({ example: 'First Breath' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({ example: 'Complete your first breathing session' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}

export class CreateAchievementDto {
  @ApiProperty({ example: 'first-breath' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @ApiProperty({ example: 'First Breath' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiProperty({ example: 'Complete your first breathing session' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: '🌬️' })
  @IsString()
  @MaxLength(20)
  icon: string;

  @ApiProperty({ enum: AchievementCategory, example: 'SESSION' })
  @IsEnum(AchievementCategory)
  category: AchievementCategory;

  @ApiPropertyOptional({ enum: AchievementTier, example: 'BRONZE' })
  @IsOptional()
  @IsEnum(AchievementTier)
  tier?: AchievementTier;

  @ApiProperty({ example: 1, description: 'Number needed to unlock' })
  @IsNumber()
  requirement: number;

  @ApiPropertyOptional({ example: 25, description: 'XP awarded when unlocked' })
  @IsOptional()
  @IsNumber()
  xpReward?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Hidden until unlocked' })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiPropertyOptional({ type: [AchievementLocaleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AchievementLocaleDto)
  locales?: AchievementLocaleDto[];
}

export class UpdateAchievementDto extends PartialType(CreateAchievementDto) {}
