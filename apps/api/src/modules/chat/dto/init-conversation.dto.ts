/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { IsString, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';

export class InitConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hubspotContactId!: string;

  @IsEnum(['LINE', 'WECHAT', 'WHATSAPP', 'FACEBOOK'])
  channelType!: string;
}
