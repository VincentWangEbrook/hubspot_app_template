import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from './permission.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  isSystem: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleWithPermissions extends RoleDto {
  permissions: Array<{
    id: string;
    code: string;
    name: string;
    resource: string;
    action: string;
  }>;
}

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * 获取所有角色
   */
  async findAll(type?: 'system' | 'tenant', tenantId?: string): Promise<RoleDto[]> {
    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (tenantId) {
      where.OR = [
        { tenantId: null, type: 'tenant', isSystem: true }, // 系统预置的租户角色
        { tenantId }, // 租户自定义角色
      ];
    }

    return this.prisma.role.findMany({
      where,
      orderBy: [{ type: 'asc' }, { isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * 获取角色详情（含权限）
   */
  async findById(id: string): Promise<RoleWithPermissions | null> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                resource: true,
                action: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return null;
    }

    return {
      ...role,
      permissions: role.rolePermissions.map(rp => rp.permission),
    };
  }

  /**
   * 根据代码获取角色
   */
  async findByCode(code: string): Promise<RoleWithPermissions | null> {
    const role = await this.prisma.role.findUnique({
      where: { code },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                resource: true,
                action: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return null;
    }

    return {
      ...role,
      permissions: role.rolePermissions.map(rp => rp.permission),
    };
  }

  /**
   * 创建角色
   */
  async create(dto: CreateRoleDto): Promise<RoleWithPermissions> {
    // 检查代码是否已存在
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`角色代码 "${dto.code}" 已存在`);
    }

    // 验证权限代码
    if (dto.permissionCodes?.length) {
      const validPermissions = await this.permissionService.findByCodes(dto.permissionCodes);
      if (validPermissions.length !== dto.permissionCodes.length) {
        throw new BadRequestException('部分权限代码无效');
      }
    }

    // 创建角色
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        tenantId: dto.tenantId,
        isSystem: false,
      },
    });

    // 分配权限
    if (dto.permissionCodes?.length) {
      const permissions = await this.permissionService.findByCodes(dto.permissionCodes);
      await this.prisma.rolePermission.createMany({
        data: permissions.map(p => ({
          roleId: role.id,
          permissionId: p.id,
        })),
      });
    }

    this.logger.log(`创建角色: ${role.code} (${role.type})`);
    return this.findById(role.id) as Promise<RoleWithPermissions>;
  }

  /**
   * 更新角色
   */
  async update(id: string, dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色不能修改');
    }

    // 更新基本信息
    await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });

    // 更新权限
    if (dto.permissionCodes !== undefined) {
      // 验证权限代码
      if (dto.permissionCodes.length) {
        const validPermissions = await this.permissionService.findByCodes(dto.permissionCodes);
        if (validPermissions.length !== dto.permissionCodes.length) {
          throw new BadRequestException('部分权限代码无效');
        }
      }

      // 删除现有权限
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      // 添加新权限
      if (dto.permissionCodes.length) {
        const permissions = await this.permissionService.findByCodes(dto.permissionCodes);
        await this.prisma.rolePermission.createMany({
          data: permissions.map(p => ({
            roleId: id,
            permissionId: p.id,
          })),
        });
      }
    }

    this.logger.log(`更新角色: ${role.code}`);
    return this.findById(id) as Promise<RoleWithPermissions>;
  }

  /**
   * 删除角色
   */
  async delete(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: { take: 1 },
        tenantMembers: { take: 1 },
      },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色不能删除');
    }

    if (role.userRoles.length > 0 || role.tenantMembers.length > 0) {
      throw new BadRequestException('该角色已被分配给用户，请先移除用户的角色');
    }

    await this.prisma.role.delete({
      where: { id },
    });

    this.logger.log(`删除角色: ${role.code}`);
  }

  /**
   * 为角色分配权限
   */
  async assignPermissions(roleId: string, permissionCodes: string[]): Promise<RoleWithPermissions> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.isSystem) {
      throw new BadRequestException('系统内置角色的权限不能修改');
    }

    // 验证权限代码
    const permissions = await this.permissionService.findByCodes(permissionCodes);
    if (permissions.length !== permissionCodes.length) {
      throw new BadRequestException('部分权限代码无效');
    }

    // 删除现有权限
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // 添加新权限
    await this.prisma.rolePermission.createMany({
      data: permissions.map(p => ({
        roleId,
        permissionId: p.id,
      })),
    });

    this.logger.log(`更新角色权限: ${role.code}, 权限数: ${permissions.length}`);
    return this.findById(roleId) as Promise<RoleWithPermissions>;
  }

  // ========== 用户角色管理 ==========

  /**
   * 获取用户的系统角色
   */
  async getUserRoles(userId: string): Promise<RoleDto[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.map(ur => ur.role);
  }

  /**
   * 为用户分配系统角色
   */
  async assignUserRole(userId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.type !== 'system') {
      throw new BadRequestException('只能分配系统级角色给用户');
    }

    // 检查是否已分配
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: { userId, roleId },
      },
    });

    if (existing) {
      return; // 已存在，无需重复添加
    }

    await this.prisma.userRole.create({
      data: { userId, roleId },
    });

    this.logger.log(`为用户 ${userId} 分配角色: ${role.code}`);
  }

  /**
   * 移除用户的系统角色
   */
  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    this.logger.log(`移除用户 ${userId} 的角色: ${roleId}`);
  }

  /**
   * 设置用户的唯一系统角色（替换现有角色）
   */
  async setUserRole(userId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.type !== 'system') {
      throw new BadRequestException('只能分配系统级角色给用户');
    }

    // 删除现有角色
    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    // 分配新角色
    await this.prisma.userRole.create({
      data: { userId, roleId },
    });

    this.logger.log(`设置用户 ${userId} 的角色为: ${role.code}`);
  }

  // ========== 租户成员角色管理 ==========

  /**
   * 获取租户成员的角色
   */
  async getTenantMemberRole(tenantId: string, userId: string): Promise<RoleDto | null> {
    const member = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      include: { role: true },
    });

    return member?.role || null;
  }

  /**
   * 设置租户成员的角色
   */
  async setTenantMemberRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    if (role.type !== 'tenant') {
      throw new BadRequestException('只能分配租户级角色给租户成员');
    }

    // 检查角色是否属于该租户（或是系统预置角色）
    if (role.tenantId && role.tenantId !== tenantId) {
      throw new BadRequestException('该角色不属于此租户');
    }

    await this.prisma.tenantMember.update({
      where: {
        tenantId_userId: { tenantId, userId },
      },
      data: { roleId },
    });

    this.logger.log(`设置租户 ${tenantId} 成员 ${userId} 的角色为: ${role.code}`);
  }
}

