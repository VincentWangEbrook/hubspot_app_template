/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { IsString, IsOptional, IsNumber, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesDto {
  @IsString()
  @MaxLength(100)
  tenantId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100, { message: 'Limit too large (max 100)' })
  limit?: number = 50;
}
