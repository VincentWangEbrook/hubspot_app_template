import { IsString, IsArray, IsOptional, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateEmergencyAccessDto {
  @IsString()
  tenantId: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @IsArray()
  @IsString({ each: true })
  scope: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  durationHours?: number;
}

export class RejectEmergencyAccessDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectReason?: string;
}

