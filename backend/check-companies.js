/**
 * Script para verificar companies no banco de dados
 * Execute: node check-companies.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 VERIFICANDO COMPANIES NO BANCO DE DADOS\n');
  console.log('='.repeat(60));

  try {
    // Buscar todas as companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            customers: true,
          },
        },
      },
    });

    if (companies.length === 0) {
      console.log('\n❌ NENHUMA COMPANY ENCONTRADA NO BANCO!\n');
      console.log('Você precisa criar uma company primeiro.\n');
      console.log('Deseja criar uma company agora? (Pressione Ctrl+C para cancelar)\n');

      // Aguarda 3 segundos
      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log('Criando company padrão...\n');

      const newCompany = await prisma.company.create({
        data: {
          name: 'Minha Empresa',
        },
      });

      console.log('✅ Company criada com sucesso!\n');
      console.log('  - ID:', newCompany.id);
      console.log('  - Nome:', newCompany.name);
      console.log('\n📝 USE ESTE ID NO FRONTEND:\n');
      console.log(`  const companyId = "${newCompany.id}";`);
      console.log('\n');
    } else {
      console.log(`\n✅ Encontradas ${companies.length} company(ies):\n`);

      companies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name}`);
        console.log(`   - ID: ${company.id}`);
        console.log(`   - Usuários: ${company._count.users}`);
        console.log(`   - Clientes: ${company._count.customers}`);
        console.log(`   - Criada em: ${company.createdAt.toLocaleDateString('pt-BR')}`);
        console.log('');
      });

      console.log('📝 PARA USAR NO FRONTEND:\n');
      console.log('Abra: frontend/app/dashboard/agenda/page.tsx');
      console.log('Altere a linha do companyId para:\n');
      console.log(`  const companyId = "${companies[0].id}"; // ${companies[0].name}`);
      console.log('\n');
    }

    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Erro ao verificar companies:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
