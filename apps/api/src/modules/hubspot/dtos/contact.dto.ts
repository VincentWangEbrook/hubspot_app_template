import { IsOptional, IsInt, Min, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'updated_at';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasLineBinding?: boolean;

  @IsOptional()
  @IsString()
  lifecycleStage?: string;

  @IsOptional()
  @IsString()
  company?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  jobtitle?: string;

  @IsOptional()
  @IsString()
  lineUserId?: string;

  @IsOptional()
  @IsString()
  lineDisplayName?: string;

  @IsOptional()
  properties?: Record<string, any>;
}

export class CreateContactDto {
  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  jobtitle?: string;

  @IsOptional()
  properties?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SyncResult {
  success: boolean;
  syncHistoryId: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  message: string;
}
