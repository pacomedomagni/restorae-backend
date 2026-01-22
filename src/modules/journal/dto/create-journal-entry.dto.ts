import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJournalEntryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  promptId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  moodEntryId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}
