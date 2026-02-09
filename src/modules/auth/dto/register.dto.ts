import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiProperty({ example: 'device-uuid-123', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @ApiProperty({ example: 'ios', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  platform?: string;

  @ApiProperty({ example: '17.0', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  osVersion?: string;

  @ApiProperty({ example: '1.0.0', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  appVersion?: string;
}
