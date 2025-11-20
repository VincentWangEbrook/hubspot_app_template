import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TenantPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a callback within a tenant-specific schema context using a transaction.
   * This ensures that 'SET search_path' applies to all queries within the callback.
   */
  async runInTenantContext<T>(
    tenantId: string,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    // Sanitize tenantId to prevent SQL injection (though uuid is safe, good practice)
    const schemaName = `tenant_${tenantId.replace(/[^a-zA-Z0-9-]/g, '')}`;
    
    return this.prisma.$transaction(async (tx) => {
      // Set the search path for this transaction
      await tx.$executeRawUnsafe(`SET search_path TO "${schemaName}", public`);
      return callback(tx);
    });
  }
}
