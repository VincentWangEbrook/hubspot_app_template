import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { EncryptionService } from '../../common/security/encryption.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
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
}
