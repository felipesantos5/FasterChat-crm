/**
 * Script de teste para verificar conexão com Evolution API
 *
 * Como usar:
 * npm run ts-node src/scripts/test-evolution-connection.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8088';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.API_URL || 'http://localhost:3001';

async function testEvolutionConnection() {
  console.log('🔍 Testando conexão com Evolution API...\n');

  console.log('📋 Configurações:');
  console.log(`   Evolution API URL: ${EVOLUTION_API_URL}`);
  console.log(`   API Key: ${EVOLUTION_API_KEY ? '✓ Configurada' : '✗ NÃO configurada'}`);
  console.log(`   Webhook URL: ${WEBHOOK_URL}`);
  console.log('');

  try {
    // 1. Testar se Evolution API está online
    console.log('1️⃣  Verificando se Evolution API está online...');
    const healthResponse = await axios.get(`${EVOLUTION_API_URL}`, {
      timeout: 5000,
      validateStatus: () => true, // Aceita qualquer status
    });

    if (healthResponse.status === 200 || healthResponse.status === 404) {
      console.log('   ✅ Evolution API está online!\n');
    } else {
      console.log(`   ⚠️  Evolution API retornou status ${healthResponse.status}\n`);
    }

    // 2. Testar autenticação
    console.log('2️⃣  Testando autenticação...');
    try {
      const authTest = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
        headers: {
          'apikey': EVOLUTION_API_KEY,
        },
        timeout: 5000,
      });
      console.log(`   ✅ Autenticação OK! (${authTest.data.length || 0} instâncias encontradas)\n`);

      // Lista instâncias existentes
      if (authTest.data && authTest.data.length > 0) {
        console.log('   📱 Instâncias existentes:');
        authTest.data.forEach((instance: any, idx: number) => {
          console.log(`      ${idx + 1}. ${instance.instance?.instanceName || instance.instanceName}`);
          console.log(`         Status: ${instance.instance?.state || instance.state || 'unknown'}`);
        });
        console.log('');
      }
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('   ❌ Erro de autenticação! Verifique EVOLUTION_API_KEY no .env\n');
        return;
      }
      console.log(`   ⚠️  Erro ao testar autenticação: ${error.message}\n`);
    }

    // 3. Testar se backend está acessível (para webhooks)
    console.log('3️⃣  Verificando se backend está acessível...');
    try {
      const webhookTest = await axios.get(`${WEBHOOK_URL}/api/webhooks/whatsapp/test`, {
        timeout: 5000,
      });
      if (webhookTest.data.success) {
        console.log('   ✅ Backend está acessível para webhooks!\n');
      }
    } catch (error: any) {
      console.log(`   ❌ Backend NÃO está acessível em ${WEBHOOK_URL}`);
      console.log('      Certifique-se que o backend está rodando\n');
    }

    // 4. Testar criação de webhook (simulação)
    console.log('4️⃣  Verificando configuração de webhook...');
    console.log(`   URL que será configurada: ${WEBHOOK_URL}/api/webhooks/whatsapp`);
    console.log('   Eventos: CONNECTION_UPDATE, QRCODE_UPDATED, MESSAGES_UPSERT');
    console.log('');

    // 5. Diagnóstico de problemas comuns
    console.log('🔧 Diagnóstico de Problemas Comuns:');

    const issues: string[] = [];

    if (!EVOLUTION_API_KEY) {
      issues.push('   ❌ EVOLUTION_API_KEY não está configurada no .env');
    }

    if (WEBHOOK_URL.includes('localhost') && EVOLUTION_API_URL.includes('localhost')) {
      issues.push('   ⚠️  Ambos usam localhost. Se Evolution está em Docker, use host.docker.internal');
    }

    if (!WEBHOOK_URL) {
      issues.push('   ❌ WEBHOOK_URL não está configurada no .env');
    }

    if (issues.length > 0) {
      console.log('');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('   ✅ Nenhum problema encontrado!\n');
    }

    // 6. Resumo e próximos passos
    console.log('');
    console.log('📝 Próximos Passos:');
    console.log('   1. Certifique-se que o backend está rodando (npm run dev)');
    console.log('   2. Crie uma instância via API ou frontend');
    console.log('   3. Escaneie o QR code com WhatsApp');
    console.log('   4. Aguarde 2-3 segundos para o webhook atualizar o status');
    console.log('   5. Verifique os logs do backend para mensagens de webhook');
    console.log('');
    console.log('🔍 Para mais detalhes, consulte: WHATSAPP_CONNECTION_GUIDE.md');

  } catch (error: any) {
    console.error('❌ Erro ao testar conexão:', error.message);
    console.log('');
    console.log('💡 Dicas:');
    console.log('   - Verifique se a Evolution API está rodando');
    console.log(`   - Teste manualmente: curl ${EVOLUTION_API_URL}`);
    console.log('   - Verifique as configurações no .env');
  }
}

// Executar teste
testEvolutionConnection().catch(console.error);
