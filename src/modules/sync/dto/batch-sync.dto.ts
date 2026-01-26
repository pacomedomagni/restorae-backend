import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  CREATE_RITUAL = 'create_ritual',
  UPDATE_RITUAL = 'update_ritual',
  DELETE_RITUAL = 'delete_ritual',
  ARCHIVE_RITUAL = 'archive_ritual',
  UNARCHIVE_RITUAL = 'unarchive_ritual',
  TOGGLE_FAVORITE = 'toggle_favorite',
  COMPLETE_RITUAL = 'complete_ritual',
}

export enum SyncEntity {
  MOOD = 'mood',
  JOURNAL = 'journal',
  RITUAL = 'ritual',
  COMPLETION = 'completion',
}

export class SyncOperationDto {
  @IsString()
  id: string;

  @IsEnum(SyncOperationType)
  type: SyncOperationType;

  @IsEnum(SyncEntity)
  entity: SyncEntity;

  @IsObject()
  data: any;

  @IsOptional()
  @IsString()
  localId?: string;
  
  @IsString()
  createdAt: string;
}

export class BatchSyncDto {
  @IsArray()
  operations: SyncOperationDto[];
}
