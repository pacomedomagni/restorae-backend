import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompletionDto {
  @ApiProperty()
  @IsString()
  ritualId: string;

  @ApiProperty({ description: 'Actual duration in seconds' })
  @IsInt()
  @Min(0)
  duration: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  completedSteps: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  totalSteps: number;

  @ApiProperty({ required: false, enum: ['great', 'good', 'okay', 'tired'] })
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
