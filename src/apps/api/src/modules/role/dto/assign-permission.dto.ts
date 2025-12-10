import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class AssignUserRoleDto {
  @IsString()
  roleId: string;
}

export class AssignTenantMemberRoleDto {
  @IsString()
  tenantId: string;

  @IsString()
  userId: string;

  @IsString()
  roleId: string;
}

