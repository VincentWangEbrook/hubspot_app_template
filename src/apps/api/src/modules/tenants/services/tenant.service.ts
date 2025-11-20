import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SchemaManagerService } from './schema-manager.service';
import { TenantMemberRole } from '../entities/tenant-member.entity'; // Keep type definition for now or move it

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
   * - If tenant exists by id or hubId, update fields (and encrypt tokens before save)
   * - Otherwise create new tenant
   */
  async upsertTenant(
    identifier: { id?: string; hubId?: string },
    patch: Partial<any>, // Use any or define a DTO, since Tenant entity is gone/changing
    options?: { setCreatedByIfMissing?: boolean },
  ) {
    // find existing by id or hubId
    let t: any = null;
    if (identifier.id) {
      t = await this.prisma.tenant.findUnique({ where: { id: identifier.id } });
    }
    if (!t && identifier.hubId) {
      t = await this.prisma.tenant.findUnique({ where: { hubId: identifier.hubId } });
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
      const newId = identifier.id ?? (patch.id ?? crypto.randomUUID());
      if (!newId) throw new Error('Missing tenant id to create new tenant');
      
      result = await this.prisma.tenant.create({
        data: {
          id: newId,
          name: patch.name ?? 'Unnamed Tenant',
          hubId: patch.hubId ?? identifier.hubId,
          hubspotAccessToken: p.hubspotAccessToken,
          hubspotRefreshToken: p.hubspotRefreshToken,
          hubspotExpiresAt: p.hubspotExpiresAt,
          hubspotScope: p.hubspotScope,
          createdBy: patch.createdBy,
          raw: patch.raw,
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

    this.logger.log(`Upsert tenant ${result.id} (hubId=${result.hubId ?? 'n/a'})`);
    return result;
  }

  async getTenant(idOrHubId: { id?: string; hubId?: string }) {
    let t: any = null;
    if (idOrHubId.id) {
      t = await this.prisma.tenant.findUnique({ where: { id: idOrHubId.id } });
    } else if (idOrHubId.hubId) {
      t = await this.prisma.tenant.findUnique({ where: { hubId: idOrHubId.hubId } });
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
    const memberships = await this.prisma.tenantMember.findMany({ where: { userId } });
    const tenantIds = Array.from(new Set([...own.map(t => t.id), ...memberships.map(m => m.tenantId)]));
    if (tenantIds.length === 0) return [];
    return this.prisma.tenant.findMany({ where: { id: { in: tenantIds } } });
  }

  async addMember(tenantId: string, userId: string, role: string = 'member') {
    return this.prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: { role },
      create: { tenantId, userId, role },
    });
  }

  async removeMember(tenantId: string, userId: string) {
    await this.prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return { success: true };
  }

  async isMemberOrOwner(tenantId: string, userId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t) return false;
    if (t.createdBy === userId) return true;
    const m = await this.prisma.tenantMember.findUnique({ where: { tenantId_userId: { tenantId, userId } } });
    return !!m;
  }

  async listMembers(tenantId: string) {
    return this.prisma.tenantMember.findMany({ where: { tenantId } });
  }

  async addMemberByEmail(tenantId: string, email: string, role: string = 'member') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('用户不存在');
    return this.addMember(tenantId, user.id, role);
  }

  async listMembersWithUserInfo(tenantId: string) {
    const members = await this.prisma.tenantMember.findMany({ where: { tenantId } });
    if (members.length === 0) return [];
    const userIds = Array.from(new Set(members.map(m => m.userId)));
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } } });
    const map = new Map(users.map(u => [u.id, { id: u.id, email: u.email, username: u.username }]));
    return members.map(m => ({ ...m, user: map.get(m.userId) }));
  }

  async updateMemberRole(tenantId: string, userId: string, role: string) {
    return this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { role },
    });
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
}
