/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { IsString, IsNumber, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { MaxUnicodeLength } from '../../../common/validators/unicode-length.validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsNumber()
  channelId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000, { message: 'Message content too long (max 5000 characters)' })
  @MaxUnicodeLength(5000, { message: 'Message content too long (max 5000 Unicode characters)' })
  content!: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'file'])
  messageType?: 'text' | 'image' | 'file';

  @IsOptional()
  metadata?: Record<string, any>;

  // 从请求上下文中获取
  userId?: string;
}
