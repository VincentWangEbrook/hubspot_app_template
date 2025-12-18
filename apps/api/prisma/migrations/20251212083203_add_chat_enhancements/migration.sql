-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "contact_avatar" TEXT,
ADD COLUMN     "contact_name" VARCHAR(255),
ADD COLUMN     "last_message_at" TIMESTAMP(3),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN     "unread_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "external_id" VARCHAR(255),
ADD COLUMN     "messageType" VARCHAR(20) NOT NULL DEFAULT 'text',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "sender_id" UUID,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'sent';

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel_type" VARCHAR(50) NOT NULL,
    "credentials" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "webhook_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_configs_tenant_id_idx" ON "channel_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "channel_configs_tenant_id_is_active_idx" ON "channel_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_tenant_id_channel_type_key" ON "channel_configs"("tenant_id", "channel_type");

-- CreateIndex
CREATE INDEX "channels_tenant_id_status_idx" ON "channels"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "channels_tenant_id_last_message_at_idx" ON "channels"("tenant_id", "last_message_at");

-- CreateIndex
CREATE INDEX "messages_channel_id_created_at_idx" ON "messages"("channel_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_tenant_id_idx" ON "messages"("tenant_id");

-- CreateIndex
CREATE INDEX "messages_external_id_idx" ON "messages"("external_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
