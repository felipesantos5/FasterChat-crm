import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para atribuir o primeiro estágio do pipeline aos clientes sem estágio
 * Execução: npx tsx scripts/assign-first-stage-to-customers.ts
 */
async function assignFirstStageToCustomers() {
  try {
    console.log('🔄 Buscando empresas...');

    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });

    console.log(`✅ Encontradas ${companies.length} empresas\n`);

    for (const company of companies) {
      console.log(`📊 Processando empresa: ${company.name} (${company.id})`);

      // Busca o primeiro estágio da empresa
      const firstStage = await prisma.pipelineStage.findFirst({
        where: { companyId: company.id },
        orderBy: { order: 'asc' },
      });

      if (!firstStage) {
        console.log(`⚠️  Empresa ${company.name} não tem estágios configurados. Pulando...`);
        continue;
      }

      // Busca clientes sem estágio
      const customersWithoutStage = await prisma.customer.findMany({
        where: {
          companyId: company.id,
          pipelineStageId: null,
          isGroup: false, // Apenas clientes individuais
        },
        select: { id: true, name: true, phone: true },
      });

      if (customersWithoutStage.length === 0) {
        console.log(`✅ Todos os clientes já têm estágio atribuído\n`);
        continue;
      }

      console.log(`🔄 Atualizando ${customersWithoutStage.length} clientes para o estágio "${firstStage.name}"...`);

      // Atualiza clientes em lote
      const result = await prisma.customer.updateMany({
        where: {
          companyId: company.id,
          pipelineStageId: null,
          isGroup: false,
        },
        data: {
          pipelineStageId: firstStage.id,
        },
      });

      console.log(`✅ ${result.count} clientes atualizados com sucesso!\n`);
    }

    console.log('🎉 Processo concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao atribuir estágios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

assignFirstStageToCustomers();
