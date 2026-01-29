import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnonymousDto {
  @ApiProperty({ example: 'device-uuid-123' })
  @IsString()
  deviceId: string;

  @ApiProperty({ example: 'ios' })
  @IsString()
  platform: string;

  @ApiProperty({ example: '17.0', required: false })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiProperty({ example: '1.0.0', required: false })
  @IsOptional()
  @IsString()
  appVersion?: string;
}
