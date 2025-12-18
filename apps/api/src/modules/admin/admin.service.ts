import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all users in the system (admin only)
   */
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * List all tenants in the system (admin only)
   */
  async getAllTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        hubspotId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Delete a user by ID (admin only)
   * Throws error if user is not found or if foreign key constraints prevent deletion
   */
  async deleteUser(userId: string) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
      return { success: true, message: `User ${user.email} deleted successfully` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new Error(
            `Cannot delete user ${user.email} because they own one or more tenants. Please transfer or delete those tenants first.`
          );
        }
      }
      throw error;
    }
  }
}
