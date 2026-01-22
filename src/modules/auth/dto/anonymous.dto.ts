import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnonymousDto {
  @ApiProperty({ example: 'device-uuid-123' })
  @IsString()
  deviceId: string;

  @ApiProperty({ example: 'ios' })
  @IsString()
  platform: string;
}
