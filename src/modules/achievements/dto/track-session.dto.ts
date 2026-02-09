import { IsNumber, IsString, IsNotEmpty, Min, MaxLength } from 'class-validator';

export class TrackSessionDto {
  @IsNumber()
  @Min(0)
  durationMinutes: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sessionType: string;
}

export class UpdateProgressDto {
  @IsNumber()
  @Min(0)
  progress: number;
}
