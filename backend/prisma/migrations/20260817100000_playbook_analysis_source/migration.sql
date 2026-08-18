-- CreateEnum
CREATE TYPE "AnalysisSource" AS ENUM ('RELEASE_LOOKUP', 'PLAYBOOK');

-- AlterTable
ALTER TABLE "comparisons" ADD COLUMN     "playbook_context" JSONB;

-- AlterTable
ALTER TABLE "impact_analyses" ADD COLUMN     "playbook_input_id" TEXT,
ADD COLUMN     "reasoning_trace" JSONB,
ADD COLUMN     "source" "AnalysisSource" NOT NULL DEFAULT 'RELEASE_LOOKUP';

-- CreateTable
CREATE TABLE "playbook_inputs" (
    "id" TEXT NOT NULL,
    "raw_yaml" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impact_analyses_playbook_input_id_key" ON "impact_analyses"("playbook_input_id");

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_playbook_input_id_fkey" FOREIGN KEY ("playbook_input_id") REFERENCES "playbook_inputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
