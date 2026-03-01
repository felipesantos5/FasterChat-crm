import { PrismaClient } from '@prisma/client';
import { getStateFromPhone } from '../src/utils/phone.utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando atualização de estados de clientes baseado no DDD...');
  const customers = await prisma.customer.findMany({
    where: {
      state: null,
    },
    select: {
      id: true,
      phone: true,
    }
  });

  console.log(`Encontrados ${customers.length} clientes sem estado definido.`);

  let updatedCount = 0;
  for (const customer of customers) {
    if (!customer.phone) continue;
    
    const state = getStateFromPhone(customer.phone);
    if (state) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { state }
      });
      updatedCount++;
    }
  }

  console.log(`Concluído! ${updatedCount} clientes tiveram o estado (UF) atualizado com sucesso.`);
}

main()
  .catch((e) => {
    console.error('Erro ao atualizar estados:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
