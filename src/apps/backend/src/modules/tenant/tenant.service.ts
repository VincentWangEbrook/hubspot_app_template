import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { EncryptionService } from '../../common/security/encryption.service';
import { TenantMember, TenantMemberRole } from './entities/tenant-member.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
    @InjectRepository(TenantMember)
    private readonly memberRepo: Repository<TenantMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Upsert semantics:
   * - If tenant exists by id or hubId, update fields (and encrypt tokens before save)
   * - Otherwise create new tenant
   *
   * patch: Partial<Tenant> 可以包含 hubspotAccessToken (plain text) / hubspotRefreshToken (plain text)
   * options.overwriteCreatedBy: 是否在首次创建时设置 createdBy（否则保持原有）
   */
  async upsertTenant(
    identifier: { id?: string; hubId?: string },
    patch: Partial<Tenant>,
    options?: { setCreatedByIfMissing?: boolean },
  ) {
    // find existing by id or hubId
    let t: Tenant | null = null;
    if (identifier.id) {
      t = await this.repo.findOne({ where: { id: identifier.id } });
    }
    if (!t && identifier.hubId) {
      t = await this.repo.findOne({ where: { hubId: identifier.hubId } });
    }

    // encrypt tokens in patch (if present)
    const p = { ...patch } as any;
    if (p.hubspotAccessToken) {
      p.hubspotAccessToken = this.encryption.encrypt(p.hubspotAccessToken);
    }
    if (p.hubspotRefreshToken) {
      p.hubspotRefreshToken = this.encryption.encrypt(p.hubspotRefreshToken);
    }

    if (!t) {
      // ensure we have an id
      const newId = identifier.id ?? (patch.id ?? (crypto?.randomUUID?.() ?? undefined));
      if (!newId) {
        throw new Error('Missing tenant id to create new tenant');
      }
      const createObj: Partial<Tenant> = { id: newId, name: patch.name ?? 'Unnamed Tenant', ...p };
      if (options?.setCreatedByIfMissing && patch.createdBy) createObj.createdBy = patch.createdBy;
      t = this.repo.create(createObj as Tenant);
    } else {
      this.repo.merge(t, p);
      // optionally set createdBy if missing
      if (options?.setCreatedByIfMissing && !t.createdBy && (patch as any).createdBy) {
        t.createdBy = (patch as any).createdBy;
      }
    }

    await this.repo.save(t);
    this.logger.log(`Upsert tenant ${t.id} (hubId=${t.hubId ?? 'n/a'})`);
    return t;
  }

  async getTenant(idOrHubId: { id?: string; hubId?: string }) {
    let t: Tenant | null = null;
    if (idOrHubId.id) {
      t = await this.repo.findOne({ where: { id: idOrHubId.id } });
    } else if (idOrHubId.hubId) {
      t = await this.repo.findOne({ where: { hubId: idOrHubId.hubId } });
    }
    if (!t) return null;

    // decrypt tokens before returning
    try {
      if (t.hubspotAccessToken) {
        (t as any).hubspotAccessToken = this.encryption.decrypt(t.hubspotAccessToken);
      }
      if (t.hubspotRefreshToken) {
        (t as any).hubspotRefreshToken = this.encryption.decrypt(t.hubspotRefreshToken);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.warn('Failed to decrypt tenant tokens', err?.message ?? err);
      } else {
        this.logger.warn('Failed to decrypt tenant tokens', String(err));
      }
    }
    return t;
  }

  async getAllTenants() {
    return this.repo.find();
  }

  async listTenantsByUser(userId: string) {
    const own = await this.repo.find({ where: { createdBy: userId } });
    const memberships = await this.memberRepo.find({ where: { userId } });
    const tenantIds = Array.from(new Set([...own.map(t => t.id), ...memberships.map(m => m.tenantId)]));
    if (tenantIds.length === 0) return [];
    return this.repo.find({ where: { id: In(tenantIds) } });
  }

  async addMember(tenantId: string, userId: string, role: TenantMemberRole = 'member') {
    let m = await this.memberRepo.findOne({ where: { tenantId, userId } });
    if (!m) {
      m = this.memberRepo.create({ tenantId, userId, role });
    } else {
      m.role = role;
    }
    return this.memberRepo.save(m);
  }

  async removeMember(tenantId: string, userId: string) {
    await this.memberRepo.delete({ tenantId, userId });
    return { success: true };
  }

  async isMemberOrOwner(tenantId: string, userId: string) {
    const t = await this.repo.findOne({ where: { id: tenantId } });
    if (!t) return false;
    if (t.createdBy === userId) return true;
    const m = await this.memberRepo.findOne({ where: { tenantId, userId } });
    return !!m;
  }

  async listMembers(tenantId: string) {
    return this.memberRepo.find({ where: { tenantId } });
  }

  async addMemberByEmail(tenantId: string, email: string, role: TenantMemberRole = 'member') {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new Error('用户不存在');
    return this.addMember(tenantId, user.id, role);
  }

  async listMembersWithUserInfo(tenantId: string) {
    const members = await this.memberRepo.find({ where: { tenantId } });
    if (members.length === 0) return [] as Array<TenantMember & { user?: Pick<User, 'id'|'email'|'username'> }>;
    const userIds = Array.from(new Set(members.map(m => m.userId)));
    const users = await this.userRepo.find({ where: { id: In(userIds) } });
    const map = new Map(users.map(u => [u.id, { id: u.id, email: u.email, username: u.username }]));
    return members.map(m => ({ ...m, user: map.get(m.userId) }));
  }

  async updateMemberRole(tenantId: string, userId: string, role: TenantMemberRole) {
    const m = await this.memberRepo.findOne({ where: { tenantId, userId } });
    if (!m) throw new Error('成员不存在');
    m.role = role;
    return this.memberRepo.save(m);
  }
}
