/**
 * Script para monitorar status das instâncias (polling)
 * Útil quando webhook não funciona
 *
 * Uso:
 * npx ts-node src/scripts/watch-status.ts
 */

import { prisma } from '../utils/prisma';
import whatsappService from '../services/whatsapp.service';

let running = true;

process.on('SIGINT', () => {
  console.log('\n\n👋 Parando monitor...');
  running = false;
});

async function watchStatus() {
  console.log('👀 Monitorando status das instâncias...');
  console.log('   (Pressione Ctrl+C para parar)');
  console.log('');

  while (running) {
    try {
      const instances = await prisma.whatsAppInstance.findMany({
        where: {
          OR: [
            { status: 'CONNECTING' },
            { status: 'CONNECTED' },
          ],
        },
      });

      if (instances.length === 0) {
        console.log('ℹ️  Nenhuma instância ativa encontrada');
        await sleep(10000);
        continue;
      }

      for (const instance of instances) {
        const oldStatus = instance.status;

        try {
          const newStatus = await whatsappService.getStatus(instance.id);

          if (oldStatus !== newStatus.status) {
            console.log('');
            console.log('🔄 Status alterado!');
            console.log(`   Instância: ${instance.instanceName}`);
            console.log(`   ${oldStatus} → ${newStatus.status}`);

            if (newStatus.status === 'CONNECTED') {
              console.log('   ✅ CONECTADO!');
              console.log(`   📱 Telefone: ${newStatus.phoneNumber}`);
            }
            console.log('');
          } else {
            process.stdout.write('.');
          }
        } catch (error: any) {
          console.error(`\n❌ Erro ao verificar ${instance.instanceName}:`, error.message);
        }
      }

      await sleep(3000); // Verifica a cada 3 segundos
    } catch (error) {
      console.error('Erro no loop:', error);
      await sleep(5000);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

watchStatus().catch(console.error);
