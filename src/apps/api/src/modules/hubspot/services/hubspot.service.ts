/**
 * Developed by eBrook Group.
 * Copyright © 2025 eBrook Group (https://www.ebrook.com.tw)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@hubspot/api-client';
import { TenantService } from '../../tenants/services/tenant.service';
import { TenantDbService } from '../../tenants/services/tenant-db.service';
import { FilterOperatorEnum, AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { handleTenantException } from '../../../common/utils/tenant/tenant-error-handler.util';

@Injectable()
export class HubspotService {
  private readonly logger = new Logger(HubspotService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantDb: TenantDbService
  ) {}
}
