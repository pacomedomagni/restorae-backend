import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LockMethod } from '@prisma/client';

export class UpdatePreferencesDto {
  @ApiProperty({ required: false, enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  soundsEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hapticsEnabled?: boolean;

  @ApiProperty({ required: false, enum: LockMethod })
  @IsOptional()
  @IsEnum(LockMethod)
  lockMethod?: LockMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  lockOnBackground?: boolean;

  @ApiProperty({ required: false, description: 'Lock timeout in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lockTimeout?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiProperty({ required: false, example: '22:00' })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiProperty({ required: false, example: '07:00' })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;
}
