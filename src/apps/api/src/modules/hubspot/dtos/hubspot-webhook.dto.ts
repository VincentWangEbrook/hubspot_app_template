import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HubspotWebhookEventDto {
  @IsNumber()
  eventId!: number;

  @IsNumber()
  subscriptionId!: number;

  @IsNumber()
  portalId!: number;

  @IsNumber()
  appId!: number;

  @IsNumber()
  occurredAt!: number;

  @IsString()
  subscriptionType!: string;

  @IsNumber()
  attemptNumber!: number;

  @IsNumber()
  objectId!: number;

  @IsString()
  changeSource!: string;

  @IsString()
  changeFlag?: string;

  @IsString()
  @IsOptional()
  propertyName?: string;

  @IsString()
  @IsOptional()
  propertyValue?: string;
}

export class HubspotWebhookPayloadDto {
  // HubSpot can send a single object or an array of objects
  // But typically for webhooks it's a JSON array of event objects
  // However, we'll handle the array at the controller level or use a wrapper if needed.
  // Since the body itself IS the array often, we might not use this wrapper class directly in @Body()
  // if we want to validate an array. 
  // But let's define the structure.
}
