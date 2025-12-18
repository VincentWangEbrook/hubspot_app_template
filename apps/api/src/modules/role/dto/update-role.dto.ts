import { IsString, IsOptional, IsArray, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

