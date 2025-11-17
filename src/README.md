# HubSpot App Template (Monorepo, v2)

Features added in v2:
- Fastify raw-body plugin registered explicitly for webhook route.
- EncryptionService added to encrypt tenant tokens at rest (AES-256-GCM). Provide TOKEN_ENCRYPTION_KEY env var or use a KMS.
- Frontend app scaffold added (Next.js pages) for OAuth + Subscription demo.
- pnpm workspace configuration (`pnpm-workspace.yaml`) and root package.json added.

## How to run

1. Start DB:
   docker-compose up -d

2. Install deps:
   pnpm install

3. Start backend:
   pnpm --filter api dev

4. Start frontend:
   pnpm --filter web dev

5. Start shared:
   pnpm --filter shared dev

## Security notes
- Tokens are stored encrypted in DB (Tenant.hubspotAccessToken / hubspotRefreshToken).
- In production, use a KMS for key management and remove `synchronize: true`.
