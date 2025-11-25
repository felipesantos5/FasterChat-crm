import axios from "axios";

// Configurações
const EVOLUTION_URL = "http://localhost:8088";
const API_KEY = "crm-api-key-secure-2024";
// URL correta para Docker -> Localhost
const WEBHOOK_URL = "http://host.docker.internal:3001/api/webhooks/whatsapp";

// Nome da sua instância (peguei do seu log)
const INSTANCE_NAME = "instance_8e59390c-9b1e-4cb7-8dd0-91929b3d0c0f_1764085604037";

async function forceConfig() {
  console.log(`🔧 Configurando webhook para: ${INSTANCE_NAME}`);

  const payload = {
    webhook: {
      url: WEBHOOK_URL,
      enabled: true,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        "MESSAGES_UPSERT", // 0: Mensagens chegando
        "CONNECTION_UPDATE", // 1: Conectou/Desconectou
        "QRCODE_UPDATED", // 2: QR Code novo
        "SEND_MESSAGE", // 3: Mensagens enviadas (AGORA É VÁLIDO!)
      ],
      webhook_headers: {
        "X-Webhook-Secret": "crm-api-key-secure-2024",
      },
    },
  };

  try {
    await axios.post(`${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`, payload, { headers: { apikey: API_KEY } });
    console.log("✅ SUCESSO! Webhook configurado e aceito pela Evolution v2.");
  } catch (error: any) {
    console.error("❌ Erro Fatal:");
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

forceConfig();
