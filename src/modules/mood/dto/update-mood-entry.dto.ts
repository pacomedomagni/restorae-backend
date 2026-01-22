import { PartialType } from '@nestjs/swagger';
import { CreateMoodEntryDto } from './create-mood-entry.dto';

export class UpdateMoodEntryDto extends PartialType(CreateMoodEntryDto) {}
