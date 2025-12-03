/**
 * Script para aplicar migrations automaticamente
 * Execute: node apply-migrations.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n============================================');
console.log('  Aplicando Migrations do Banco de Dados');
console.log('============================================\n');

// 1. Ler arquivo SQL
const sqlFile = path.join(__dirname, 'create-google-calendar-tables.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('✓ Arquivo SQL carregado\n');

// 2. Executar SQL usando npx prisma db execute
console.log('📝 Executando SQL no banco de dados...\n');

try {
  // Salva SQL em arquivo temporário
  const tempFile = path.join(__dirname, 'temp-migration.sql');
  fs.writeFileSync(tempFile, sql);

  // Executa usando prisma db execute
  execSync(`npx prisma db execute --file ./temp-migration.sql --schema ./prisma/schema.prisma`, {
    stdio: 'inherit',
    cwd: __dirname
  });

  // Remove arquivo temporário
  fs.unlinkSync(tempFile);

  console.log('\n✅ SQL executado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao executar SQL:', error.message);
  console.log('\n📝 Tente executar manualmente:\n');
  console.log('MÉTODO 1 - Usando psql:');
  console.log('  psql -U postgres -d crm -f create-google-calendar-tables.sql\n');
  console.log('MÉTODO 2 - Copie e cole o SQL no pgAdmin ou DBeaver\n');
  process.exit(1);
}

// 3. Gerar Prisma Client
console.log('🔨 Gerando Prisma Client...\n');

try {
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: __dirname
  });

  console.log('\n✅ Prisma Client gerado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao gerar Prisma Client:', error.message);
  process.exit(1);
}

console.log('============================================');
console.log('  ✅ Migrations aplicadas com sucesso!');
console.log('============================================\n');
console.log('Agora você pode reiniciar o servidor:');
console.log('  npm run dev\n');
