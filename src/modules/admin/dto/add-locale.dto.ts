import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength } from 'class-validator';

export class AddLocaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  locale: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateLocaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
