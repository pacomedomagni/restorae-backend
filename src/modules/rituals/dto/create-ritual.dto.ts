import { IsString, IsOptional, IsBoolean, IsArray, IsEnum, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TimeOfDay, DayOfWeek } from '@prisma/client';

class RitualStepDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Duration in seconds' })
  @IsInt()
  @Min(1)
  duration: number;
}

export class CreateRitualDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TimeOfDay, required: false })
  @IsOptional()
  @IsEnum(TimeOfDay)
  timeOfDay?: TimeOfDay;

  @ApiProperty({ enum: DayOfWeek, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  days?: DayOfWeek[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiProperty({ required: false, example: '08:00' })
  @IsOptional()
  @IsString()
  reminderTime?: string;

  @ApiProperty({ type: [RitualStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RitualStepDto)
  steps: RitualStepDto[];
}
