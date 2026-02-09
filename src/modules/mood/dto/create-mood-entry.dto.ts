import { IsEnum, IsOptional, IsString, IsArray, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MoodType, MoodContext } from '@prisma/client';

export class CreateMoodEntryDto {
  @ApiProperty({ enum: MoodType })
  @IsEnum(MoodType)
  mood: MoodType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  note?: string;

  @ApiProperty({ enum: MoodContext, required: false })
  @IsOptional()
  @IsEnum(MoodContext)
  context?: MoodContext;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  factors?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
