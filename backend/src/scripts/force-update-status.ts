/**
 * Script para forçar atualização de status da instância WhatsApp
 *
 * Uso:
 * npx ts-node src/scripts/force-update-status.ts <instance_id_ou_name>
 */

import { prisma } from '../utils/prisma';
import whatsappService from '../services/whatsapp.service';

async function forceUpdateStatus() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error('❌ Uso: npx ts-node src/scripts/force-update-status.ts <instance_id_ou_name>');
    process.exit(1);
  }

  console.log('🔍 Buscando instância:', identifier);

  // Busca por ID ou nome
  let instance = await prisma.whatsAppInstance.findUnique({
    where: { id: identifier },
  }).catch(() => null);

  if (!instance) {
    instance = await prisma.whatsAppInstance.findFirst({
      where: { instanceName: identifier },
    });
  }

  if (!instance) {
    console.error('❌ Instância não encontrada!');
    console.log('\n📋 Instâncias disponíveis:');
    const instances = await prisma.whatsAppInstance.findMany();
    instances.forEach(i => {
      console.log(`   - ${i.instanceName} (ID: ${i.id})`);
      console.log(`     Status: ${i.status}`);
    });
    process.exit(1);
  }

  console.log('✓ Instância encontrada:', instance.instanceName);
  console.log('  Status atual:', instance.status);
  console.log('');

  try {
    console.log('🔄 Consultando status na Evolution API...');
    const status = await whatsappService.getStatus(instance.id);

    console.log('✅ Status atualizado!');
    console.log('  Novo status:', status.status);
    console.log('  Telefone:', status.phoneNumber || 'N/A');
    console.log('');

    if (status.status === 'CONNECTED') {
      console.log('🎉 WhatsApp está CONECTADO!');
      console.log('');
      console.log('📝 Próximos passos:');
      console.log('   1. Verifique o frontend - status deve aparecer como "Conectado"');
      console.log('   2. Configure a IA da empresa (Dashboard > Configurações > IA)');
      console.log('   3. Habilite IA para uma conversa');
      console.log('   4. Envie mensagem teste do WhatsApp');
    } else if (status.status === 'CONNECTING') {
      console.log('⏳ Ainda conectando...');
      console.log('   Escaneie o QR code se ainda não fez');
    } else {
      console.log('❌ Status:', status.status);
      console.log('   Pode ser necessário reconectar');
    }
  } catch (error: any) {
    console.error('❌ Erro ao atualizar status:', error.message);
    process.exit(1);
  }
}

forceUpdateStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
