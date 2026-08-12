-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('healthy', 'warning', 'critical', 'unknown');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('running', 'stopped', 'unknown');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "os_name" TEXT NOT NULL,
    "os_version" TEXT NOT NULL,
    "status" "ServerStatus" NOT NULL DEFAULT 'unknown',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_collected_at" TIMESTAMP(3),

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_snapshots" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "kernel" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "cpu_cores" INTEGER NOT NULL,
    "cpu_usage_percent" INTEGER NOT NULL,
    "memory_total_mb" INTEGER NOT NULL,
    "memory_used_percent" INTEGER NOT NULL,
    "disk_total_gb" INTEGER NOT NULL,
    "disk_used_percent" INTEGER NOT NULL,
    "network_data" JSONB,
    "services" JSONB NOT NULL,
    "modules" JSONB NOT NULL,
    "configuration" JSONB NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_inventory" (
    "id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_information" (
    "id" TEXT NOT NULL,
    "software" TEXT NOT NULL,
    "current_version" TEXT NOT NULL,
    "latest_version" TEXT NOT NULL,
    "release_date" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "security_changes" JSONB NOT NULL,
    "configuration_changes" JSONB NOT NULL,
    "compatibility_changes" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_information_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparisons" (
    "id" TEXT NOT NULL,
    "server_snapshot_id" TEXT NOT NULL,
    "release_information_id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "version_gap" JSONB NOT NULL,
    "security_changes_detected" BOOLEAN NOT NULL,
    "configuration_changes_detected" BOOLEAN NOT NULL,
    "server_dependencies" JSONB NOT NULL,
    "risk_factors" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_analyses" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "comparison_id" TEXT NOT NULL,
    "impact_level" "ImpactLevel" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "executive_summary" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "security_impact" JSONB NOT NULL,
    "compatibility_impact" JSONB NOT NULL,
    "operational_risk" JSONB NOT NULL,
    "performance_impact" JSONB NOT NULL,
    "recommended_actions" JSONB NOT NULL,
    "pre_upgrade_checks" JSONB NOT NULL,
    "rollback_considerations" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "report_number" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servers_hostname_key" ON "servers"("hostname");

-- CreateIndex
CREATE INDEX "server_snapshots_server_id_idx" ON "server_snapshots"("server_id");

-- CreateIndex
CREATE INDEX "software_inventory_snapshot_id_idx" ON "software_inventory"("snapshot_id");

-- CreateIndex
CREATE INDEX "comparisons_server_snapshot_id_idx" ON "comparisons"("server_snapshot_id");

-- CreateIndex
CREATE INDEX "comparisons_release_information_id_idx" ON "comparisons"("release_information_id");

-- CreateIndex
CREATE UNIQUE INDEX "impact_analyses_comparison_id_key" ON "impact_analyses"("comparison_id");

-- CreateIndex
CREATE INDEX "impact_analyses_server_id_idx" ON "impact_analyses"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_analysis_id_key" ON "reports"("analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_report_number_key" ON "reports"("report_number");

-- AddForeignKey
ALTER TABLE "server_snapshots" ADD CONSTRAINT "server_snapshots_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_inventory" ADD CONSTRAINT "software_inventory_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "server_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_server_snapshot_id_fkey" FOREIGN KEY ("server_snapshot_id") REFERENCES "server_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_release_information_id_fkey" FOREIGN KEY ("release_information_id") REFERENCES "release_information"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_comparison_id_fkey" FOREIGN KEY ("comparison_id") REFERENCES "comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "impact_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
