-- CreateTable
CREATE TABLE "hubspot_sync_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sync_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "failed_records" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "error_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hubspot_sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hubspot_sync_history_tenant_id_idx" ON "hubspot_sync_history"("tenant_id");

-- CreateIndex
CREATE INDEX "hubspot_sync_history_status_idx" ON "hubspot_sync_history"("status");

-- CreateIndex
CREATE INDEX "hubspot_sync_history_started_at_idx" ON "hubspot_sync_history"("started_at");
