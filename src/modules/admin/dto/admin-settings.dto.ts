import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, MaxLength } from 'class-validator';

export class CreateFeatureFlagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}

export class UpdateLegalContentDto {
  @IsOptional()
  @IsString()
  termsOfService?: string;

  @IsOptional()
  @IsString()
  privacyPolicy?: string;
}

export class UpdateAppVersionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  minIOSVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  minAndroidVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currentVersion?: string;
}

export class UpdateMaintenanceDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  scheduledEnd?: string;
}
