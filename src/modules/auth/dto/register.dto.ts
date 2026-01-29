import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'device-uuid-123', required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: 'ios', required: false })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiProperty({ example: '17.0', required: false })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiProperty({ example: '1.0.0', required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}
