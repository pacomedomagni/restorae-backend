import { IsEnum, IsOptional, IsNumber, IsBoolean, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXITED = 'EXITED',
  INTERRUPTED = 'INTERRUPTED',
}

export class UpdateSessionDto {
  @ApiPropertyOptional({ enum: SessionStatus, description: 'Session status' })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @ApiPropertyOptional({ description: 'Number of completed activities' })
  @IsOptional()
  @IsNumber()
  completedCount?: number;

  @ApiPropertyOptional({ description: 'Number of skipped activities' })
  @IsOptional()
  @IsNumber()
  skippedCount?: number;

  @ApiPropertyOptional({ description: 'Total duration in seconds' })
  @IsOptional()
  @IsNumber()
  totalDuration?: number;

  @ApiPropertyOptional({ description: 'Whether session was partial' })
  @IsOptional()
  @IsBoolean()
  wasPartial?: boolean;

  @ApiPropertyOptional({ description: 'Whether session was interrupted' })
  @IsOptional()
  @IsBoolean()
  wasInterrupted?: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Activity was completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ description: 'Activity was skipped' })
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;

  @ApiPropertyOptional({ description: 'Actual duration in seconds' })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ description: 'When activity started' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ description: 'When activity completed' })
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
