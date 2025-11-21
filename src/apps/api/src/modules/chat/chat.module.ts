import { Module, Global } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { LineModule } from '../line/line.module';
import { TenantModule } from '../tenants/tenant.module';

@Global()
@Module({
  imports: [LineModule, TenantModule],
  controllers: [ChatController],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
