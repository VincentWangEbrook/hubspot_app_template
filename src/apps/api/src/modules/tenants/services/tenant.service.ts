import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchemaManagerService } from './schema-manager.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly schemaManager: SchemaManagerService,
  ) {}

  /**
   * Upsert semantics:
   * - If tenant exists by id or hubspot_id, update fields (and encrypt tokens before save)
   * - Otherwise create new tenant
   */
  async upsertTenant(
    identifier: { id: string; hubspot_id: string,  },
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
      result = await this.prisma.tenant.create({
        data: {
          id: newId,
          name: p.name ?? 'Unnamed Tenant',
          hubspotId: identifier.hubspot_id,
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
      } catch (e) {
        this.logger.error(`Failed to create schema for tenant ${result.id}`, e);
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
    });

    // Sort by role: owner first, then admin, then member
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return members.sort((a, b) => {
      const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      return aOrder - bOrder;
    });
  }

  async addMemberByEmail(
    tenantId: string,
    email: string,
    role: 'admin' | 'member',
    currentUserId: string
  ) {
    // Check if current user has permission (must be owner or admin)
    await this.isMemberOrOwner(tenantId, currentUserId);

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
        role,
      },
    });
  }

  async removeMember(tenantId: string, userIdToRemove: string, currentUserId: string) {
    // Check if current user has permission
    await this.isMemberOrOwner(tenantId, currentUserId);

    // Get the member to remove
    const memberToRemove = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToRemove,
        },
      },
    });

    if (!memberToRemove) {
      throw new Error('成员不存在');
    }

    // Cannot remove owner
    if (memberToRemove.role === 'owner') {
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
    });

    if (currentMember?.role === 'admin' && memberToRemove.role === 'admin') {
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
    newRole: 'admin' | 'member' | 'owner',
    currentUserId: string
  ) {
    // Check if current user has permission (only owner can change roles)
    await this.isMemberOrOwner(tenantId, currentUserId);

    // Get the member to update
    const memberToUpdate = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: userIdToUpdate,
        },
      },
    });

    if (!memberToUpdate) {
      throw new Error('成员不存在');
    }

    // Cannot change owner role
    if (memberToUpdate.role === 'owner') {
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
      data: { role: newRole },
    });
  }

  /**
   * Public helper to check if a user is owner or admin of a tenant.
   * Returns true if the user created the tenant or has role 'owner'/'admin'.
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
      select: { role: true },
    });
    if (!member) return false;
    return ['owner', 'admin'].includes(member.role);
  }
}