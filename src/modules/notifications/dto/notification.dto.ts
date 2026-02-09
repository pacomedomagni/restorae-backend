import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  pushToken: string;
}

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  time: string;

  @IsOptional()
  @IsString()
  ritualId?: string;
}

export class UpdateReminderDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  time?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
