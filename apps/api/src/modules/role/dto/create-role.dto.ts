import { IsString, IsOptional, IsArray, IsIn, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: '角色代码只能包含小写字母、数字和下划线，且必须以字母开头',
  })
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsIn(['system', 'tenant'])
  type: 'system' | 'tenant';

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionCodes?: string[];
}

