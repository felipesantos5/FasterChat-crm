-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FlowExecutionStatus" AS ENUM ('DELAYED', 'RUNNING', 'PAUSED', 'WAITING_REPLY', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL DEFAULT 'webhook',
    "webhook_slug" TEXT,
    "last_webhook_payload" JSONB,
    "status" "FlowStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_nodes" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_edges" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "source_node_id" TEXT NOT NULL,
    "source_handle" TEXT,
    "target_node_id" TEXT NOT NULL,
    "target_handle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_executions" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "current_node_id" TEXT,
    "variables" JSONB DEFAULT '{}',
    "status" "FlowExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "resumes_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flows_webhook_slug_key" ON "flows"("webhook_slug");

-- CreateIndex
CREATE INDEX "flows_company_id_idx" ON "flows"("company_id");

-- CreateIndex
CREATE INDEX "flows_status_idx" ON "flows"("status");

-- CreateIndex
CREATE INDEX "flow_nodes_flow_id_idx" ON "flow_nodes"("flow_id");

-- CreateIndex
CREATE INDEX "flow_edges_flow_id_idx" ON "flow_edges"("flow_id");

-- CreateIndex
CREATE INDEX "flow_edges_source_node_id_idx" ON "flow_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "flow_edges_target_node_id_idx" ON "flow_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "flow_executions_flow_id_idx" ON "flow_executions"("flow_id");

-- CreateIndex
CREATE INDEX "flow_executions_contact_phone_idx" ON "flow_executions"("contact_phone");

-- CreateIndex
CREATE INDEX "flow_executions_status_idx" ON "flow_executions"("status");

-- CreateIndex
CREATE INDEX "flow_executions_resumes_at_idx" ON "flow_executions"("resumes_at");

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_nodes" ADD CONSTRAINT "flow_nodes_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_edges" ADD CONSTRAINT "flow_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "flow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_current_node_id_fkey" FOREIGN KEY ("current_node_id") REFERENCES "flow_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
