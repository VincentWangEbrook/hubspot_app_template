import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantService } from './modules/tenant/tenant.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tenantService = app.get(TenantService);

  await tenantService.upsertTenant('tenant_demo', {
    name: 'Demo Tenant',
    hubspotAccessToken: 'demo-access-token',
    hubspotRefreshToken: 'demo-refresh-token',
  });

  console.log('Demo tenant seeded');
  await app.close();
}

bootstrap();
