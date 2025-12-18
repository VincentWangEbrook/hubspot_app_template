import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_ROLES_KEY } from './tenant-roles.decorator';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.session?.user;

    if (!user) {
      return false;
    }

    // Extract tenantId from params or body
    const tenantId = request.params.tenantId || request.body?.tenantId;

    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required for this operation');
    }

    // Check user's role in the tenant
    const member = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this tenant');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
