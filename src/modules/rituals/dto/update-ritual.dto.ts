import { PartialType } from '@nestjs/swagger';
import { CreateRitualDto } from './create-ritual.dto';

export class UpdateRitualDto extends PartialType(CreateRitualDto) {}
