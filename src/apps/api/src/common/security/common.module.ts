import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { ConfigModule } from '@nestjs/config';
import { RolesGuard } from './roles.guard';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule],
  providers: [EncryptionService, RolesGuard, JwtService],
  exports: [EncryptionService, RolesGuard, JwtService],
})
export class CommonSecurityModule {}
