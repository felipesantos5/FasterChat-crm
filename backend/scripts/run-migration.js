const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('Adding intent script columns to conversations table...');
  
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE conversations 
        ADD COLUMN IF NOT EXISTS active_intent_script_id TEXT,
        ADD COLUMN IF NOT EXISTS intent_script_collected_data JSONB
    `);
    console.log('✅ Columns added successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
