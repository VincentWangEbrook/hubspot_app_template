/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { IsString, IsOptional, IsNumber, IsEnum, Min, MaxLength, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetConversationsDto {
  @IsString()
  @MaxLength(100)
  tenantId!: string;

  @IsOptional()
  @IsEnum(['LINE', 'WECHAT', 'WHATSAPP', 'FACEBOOK'])
  channelType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Search query too long (max 200 characters)' })
  search?: string;

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
  limit?: number = 20;
}
