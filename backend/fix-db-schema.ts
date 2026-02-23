import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding 'history' column to 'flow_executions'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flow_executions" ADD COLUMN "history" JSONB DEFAULT '[]';`);
    console.log("Column 'history' added successfully.");
  } catch (e: any) {
    if (e.message && e.message.includes('already exists')) {
      console.log("Column 'history' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  try {
    console.log("Adding 'variables' column to 'flow_executions'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flow_executions" ADD COLUMN "variables" JSONB DEFAULT '{}';`);
    console.log("Column 'variables' added successfully.");
  } catch (e: any) {
    if (e.message && e.message.includes('already exists')) {
      console.log("Column 'variables' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  try {
    console.log("Adding 'contactPhone' column to 'flow_executions'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flow_executions" ADD COLUMN "contact_phone" TEXT;`);
    console.log("Column 'contact_phone' added successfully.");
  } catch (e: any) {
    if (e.message && e.message.includes('already exists')) {
      console.log("Column 'contact_phone' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  // Also check if trigger_type, webhook_slug, last_webhook_payload are in flow
  try {
    console.log("Adding 'trigger_type' column to 'flows'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flows" ADD COLUMN "trigger_type" TEXT DEFAULT 'webhook';`);
    console.log("Column 'trigger_type' added successfully.");
  } catch (e: any) {
     if (e.message && e.message.includes('already exists')) {
      console.log("Column 'trigger_type' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  try {
    console.log("Adding 'webhook_slug' column to 'flows'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flows" ADD COLUMN "webhook_slug" TEXT;`);
    console.log("Column 'webhook_slug' added successfully.");
  } catch (e: any) {
     if (e.message && e.message.includes('already exists')) {
      console.log("Column 'webhook_slug' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  try {
    console.log("Adding 'last_webhook_payload' column to 'flows'...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "flows" ADD COLUMN "last_webhook_payload" JSONB;`);
    console.log("Column 'last_webhook_payload' added successfully.");
  } catch (e: any) {
     if (e.message && e.message.includes('already exists')) {
      console.log("Column 'last_webhook_payload' already exists.");
    } else {
      console.error("Error adding column:", e);
    }
  }

  await prisma.$disconnect();
}

main();
