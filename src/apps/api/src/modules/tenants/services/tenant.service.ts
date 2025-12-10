import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchemaManagerService } from './schema-manager.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  // 缓存角色ID
  private roleCache: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly schemaManager: SchemaManagerService,
  ) {}

  /**
   * 获取租户角色ID（带缓存）
   */
  private async getTenantRoleId(roleCode: string): Promise<string> {
    if (this.roleCache.has(roleCode)) {
      return this.roleCache.get(roleCode)!;
    }

    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new BadRequestException(`角色 ${roleCode} 不存在，请先运行数据库 seed`);
    }

    this.roleCache.set(roleCode, role.id);
    return role.id;
  }

  /**
   * Upsert semantics:
   * - If tenant exists by id or hubspot_id, update fields (and encrypt tokens before save)
   * - Otherwise create new tenant
   */
  async upsertTenant(
    identifier: { id?: string; hubspot_id?: string },
    patch: Partial<any>, // Use any or define a DTO, since Tenant entity is gone/changing
    options?: { setCreatedByIfMissing?: boolean },
  ) {
    // find existing by id or hubspot_id
    let t: any = null;
    if (identifier.id) {
      t = await this.prisma.tenant.findUnique({ where: { id: identifier.id } });
    }
    if (!t && identifier.hubspot_id) {
      t = await this.prisma.tenant.findUnique({ where: { hubspotId: String(identifier.hubspot_id) } });
    }

    // encrypt tokens in patch (if present)
    const p = { ...patch };
    if (p.hubspotAccessToken) {
      p.hubspotAccessToken = this.encryption.encrypt(p.hubspotAccessToken);
    }
    if (p.hubspotRefreshToken) {
      p.hubspotRefreshToken = this.encryption.encrypt(p.hubspotRefreshToken);
    }

    let result;
    let isNew = false;

    if (!t) {
      // Create
      const newId = identifier.id;
      if (!newId) throw new Error('Missing tenant id to create new tenant');
      const hubId = identifier.hubspot_id;
      if (!hubId) throw new Error('Missing hubspot_id to create new tenant');

      result = await this.prisma.tenant.create({
        data: {
          id: newId,
          name: p.name ?? 'Unnamed Tenant',
          hubspotId: hubId,
          hubspotAccessToken: p.hubspotAccessToken,
          hubspotRefreshToken: p.hubspotRefreshToken,
          hubspotExpiresAt: p.hubspotExpiresAt,
          hubspotScope: p.hubspotScope,
          createdBy: p.createdBy,
          raw: p.raw,
          // If we want to link user, we need userId. Assuming createdBy is just string for now as per schema.
        }
      });
      isNew = true;
    } else {
      // Update
      const updateData: any = { ...p };
      if (options?.setCreatedByIfMissing && !t.createdBy && patch.createdBy) {
        updateData.createdBy = patch.createdBy;
      }
      // Remove id from updateData if present
      delete updateData.id;
      
      result = await this.prisma.tenant.update({
        where: { id: t.id },
        data: updateData,
      });
    }

    if (isNew) {
      try {
        await this.schemaManager.createTenantSchema(result.id);
        this.logger.log(`Created schema for new tenant ${result.id}`);

        // Add creator as owner
        if (result.createdBy) {
          const ownerRoleId = await this.getTenantRoleId('tenant_owner');
          await this.prisma.tenantMember.create({
            data: {
              tenantId: result.id,
              userId: result.createdBy,
              roleId: ownerRoleId,
            },
          });
          this.logger.log(`Added creator ${result.createdBy} as owner of tenant ${result.id}`);
        }
      } catch (e) {
        this.logger.error(`Failed to initialize tenant ${result.id}`, e);
      }
    }

    this.logger.log(`Upsert tenant ${result.id} (hubspot_id=${result.hubspotId ?? 'n/a'})`);
    return result;
  }

  async getTenant(idOrHubId: { id?: string; hubspot_id?: string }) {
    let t: any = null;
    if (idOrHubId.id) {
      t = await this.prisma.tenant.findUnique({ where: { id: idOrHubId.id } });
    } else if (idOrHubId.hubspot_id) {
      t = await this.prisma.tenant.findUnique({ where: { hubspotId: idOrHubId.hubspot_id } });
    }
    if (!t) return null;

    // decrypt tokens before returning
    try {
      if (t.hubspotAccessToken) {
        t.hubspotAccessToken = this.encryption.decrypt(t.hubspotAccessToken);
      }
      if (t.hubspotRefreshToken) {
        t.hubspotRefreshToken = this.encryption.decrypt(t.hubspotRefreshToken);
      }
    } catch (err: unknown) {
      this.logger.warn('Failed to decrypt tenant tokens', String(err));
    }
    return t;
  }

  async getAllTenants() {
    return this.prisma.tenant.findMany();
  }

  async listTenantsByUser(userId: string) {
    const own = await this.prisma.tenant.findMany({ where: { createdBy: userId } });
    const memberships = await this.prisma.tenantMember.findMany({ where: { userId: userId } });
    const tenantIds = Array.from(new Set([...own.map(t => t.id), ...memberships.map(m => m.tenantId)]));
    if (tenantIds.length === 0) return [];
    return this.prisma.tenant.findMany({ where: { id: { in: tenantIds } } });
  }

  async getHubspotAccessToken(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { hubspotAccessToken: true },
    });

    if (!tenant || !tenant.hubspotAccessToken) {
      throw new NotFoundException(`租户 ${tenantId} 未配置 HubSpot Access Token`);
    }

    return this.encryption.decrypt(tenant.hubspotAccessToken);
  }

  // ===== TenantMember Management =====

  async getTenantMembers(tenantId: string) {
    const members = await this.prisma.tenantMember.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Sort by role: owner first, then admin, then member
    const roleOrder: Record<string, number> = { tenant_owner: 0, tenant_admin: 1, tenant_member: 2 };
    return members.sort((a, b) => {
      const aOrder = roleOrder[a.role?.code || ''] ?? 3;
      const bOrder = roleOrder[b.role?.code || ''] ?? 3;
      return aOrder - bOrder;
    });
  }

  async addMemberByEmail(
    tenantId: string,
    email: string,
    roleId: string,
    currentUserId: string
  ) {
    // Check if current user has permission (must be owner or admin)
    await this.isMemberOrOwner(tenantId, currentUserId);

    // Validate role exists and is tenant type
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role || role.type !== 'tenant') {
      throw new BadRequestException('无效的角色');
    }

    // Find user by email
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(`用户 ${email} 不存在`);
    }

    // Check if already a member
    const existing = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      throw new Error('该用户已经是成员');
    }

    // Add member
    return this.prisma.tenantMember.create({
      data: {
        tenantId,
        userId: user.id,
        roleId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async removeMember(tenantId: string, userIdToRemove: string, currentUserId: string) {
    // Check if current user has permission
    await this.isMemberOrOwner(tenantId, currentUserId);

    // Get the member to remove with role info
    const memberToRemove = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToRemove,
        },
      },
      include: {
        role: true,
      },
    });

    if (!memberToRemove) {
      throw new Error('成员不存在');
    }

    // Cannot remove owner
    if (memberToRemove.role?.code === 'tenant_owner') {
      throw new Error('不能移除所有者');
    }

    // Admin cannot remove other admins (only owner can)
    const currentMember = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: currentUserId,
        },
      },
      include: {
        role: true,
      },
    });

    if (currentMember?.role?.code === 'tenant_admin' && memberToRemove.role?.code === 'tenant_admin') {
      throw new Error('管理员不能移除其他管理员');
    }

    // Remove the member
    return this.prisma.tenantMember.delete({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToRemove,
        },
      },
    });
  }

  async updateMemberRole(
    tenantId: string,
    userIdToUpdate: string,
    newRoleId: string,
    currentUserId: string
  ) {
    // Check if current user has permission (only owner can change roles)
    const currentUserMembership = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: currentUserId } },
      include: { role: true },
    });
    
    const isOwner = currentUserMembership?.role?.code === 'tenant_owner';
    // Fallback check for creator if not found in members
    let isCreator = false;
    if (!isOwner) {
       const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { createdBy: true } });
       isCreator = tenant?.createdBy === currentUserId;
    }

    if (!isOwner && !isCreator) {
      throw new Error('只有所有者可以修改成员角色');
    }

    // Validate new role exists and is tenant type
    const newRole = await this.prisma.role.findUnique({
      where: { id: newRoleId },
    });
    if (!newRole || newRole.type !== 'tenant') {
      throw new BadRequestException('无效的角色');
    }

    // Cannot set owner role through this method
    if (newRole.code === 'tenant_owner') {
      throw new BadRequestException('不能通过此方法设置所有者角色');
    }

    // Get the member to update
    const memberToUpdate = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToUpdate,
        },
      },
      include: { role: true },
    });

    if (!memberToUpdate) {
      throw new Error('成员不存在');
    }

    // Cannot change owner role
    if (memberToUpdate.role?.code === 'tenant_owner') {
      throw new Error('不能修改所有者的角色');
    }

    // Update role
    return this.prisma.tenantMember.update({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToUpdate,
        },
      },
      data: { roleId: newRoleId },
      include: {
        role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Public helper to check if a user is owner or admin of a tenant.
   * Returns true if the user created the tenant or has role 'tenant_owner'/'tenant_admin'.
   */
  async isMemberOrOwner(tenantId: string, userId: string): Promise<boolean> {
    // Check creator
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { createdBy: true },
    });
    if (tenant?.createdBy === userId) return true;

    // Check member role
    const member = await this.prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: { role: true },
    });
    if (!member) return false;
    return ['tenant_owner', 'tenant_admin'].includes(member.role?.code || '');
  }

  /**
   * 获取可用的租户角色列表（用于前端展示）
   */
  async getAvailableTenantRoles() {
    return this.prisma.role.findMany({
      where: {
        type: 'tenant',
        OR: [
          { tenantId: null }, // 系统预置的租户角色
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
      },
    });
  }
}