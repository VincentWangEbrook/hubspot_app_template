import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { ConfigModule } from '@nestjs/config';
import { RolesGuard } from './roles.guard';
import { SessionGuard } from './session.guard';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [ConfigModule],
  providers: [EncryptionService, RolesGuard, SessionGuard, JwtService],
  exports: [EncryptionService, RolesGuard, SessionGuard, JwtService],
})
export class CommonSecurityModule {}
