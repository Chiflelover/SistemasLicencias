-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('RUNNING', 'RESTORED');

-- CreateEnum
CREATE TYPE "SimulationOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';


-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'RUNNING',
    "realStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulatedStartAt" TIMESTAMP(3) NOT NULL,
    "simulatedEndAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "startedByEmail" TEXT,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationChange" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" "SimulationOperation" NOT NULL,
    "recordId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationRun_status_idx" ON "SimulationRun"("status");

-- CreateIndex
CREATE INDEX "SimulationRun_realStartedAt_idx" ON "SimulationRun"("realStartedAt");

-- CreateIndex
CREATE INDEX "SimulationChange_runId_idx" ON "SimulationChange"("runId");

-- CreateIndex
CREATE INDEX "SimulationChange_model_idx" ON "SimulationChange"("model");

-- CreateIndex
CREATE INDEX "SimulationChange_createdAt_idx" ON "SimulationChange"("createdAt");

-- AddForeignKey
ALTER TABLE "SimulationChange" ADD CONSTRAINT "SimulationChange_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

