import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const EVOLUTION_URL = process.env.EVOLUTION_API_URL || "http://localhost:8088";
const API_KEY = process.env.EVOLUTION_API_KEY;
// Garante que usa o host.docker.internal
const WEBHOOK_URL = process.env.WEBHOOK_URL || "http://host.docker.internal:3001";

async function fixWebhook() {
  console.log("🔧 Iniciando correção de Webhook...");

  try {
    // 1. Buscar instâncias
    const { data: instances } = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: API_KEY },
    });

    if (instances.length === 0) {
      console.log("❌ Nenhuma instância encontrada.");
      return;
    }

    console.log(`📋 Encontradas ${instances.length} instâncias.`);

    // 2. Atualizar cada instância
    for (const item of instances) {
      const instanceName = item.instance.instanceName;
      const fullUrl = `${WEBHOOK_URL}/api/webhooks/whatsapp`;

      console.log(`\n🔄 Atualizando: ${instanceName}`);
      console.log(`   URL Alvo: ${fullUrl}`);

      await axios.post(
        `${EVOLUTION_URL}/webhook/set/${instanceName}`,
        {
          url: fullUrl,
          enabled: true,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "STATUS_INSTANCE"],
          webhook_headers: {
            "X-Webhook-Secret": process.env.WEBHOOK_SECRET,
          },
        },
        {
          headers: { apikey: API_KEY },
        }
      );

      console.log(`   ✅ ${instanceName} atualizada com sucesso!`);
    }
  } catch (error: any) {
    console.error("❌ Erro fatal:", error.message);
    if (error.response) console.error("Dados:", error.response.data);
  }
}

fixWebhook();
