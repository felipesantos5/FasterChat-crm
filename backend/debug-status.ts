import axios from "axios";
import { prisma } from "./src/utils/prisma";

async function check() {
  // Pega a primeira instância do banco
  const instance = await prisma.whatsAppInstance.findFirst();

  if (!instance) {
    console.log("❌ Nenhuma instância no banco de dados.");
    return;
  }

  console.log(`🔍 Analisando instância: ${instance.instanceName}`);
  console.log(`📊 Status no Banco CRM: ${instance.status}`);

  const EVOLUTION_URL = "http://localhost:8088";
  const API_KEY = "crm-api-key-secure-2024";

  try {
    // 1. Checar Connection State
    const state = await axios.get(`${EVOLUTION_URL}/instance/connectionState/${instance.instanceName}`, { headers: { apikey: API_KEY } });
    console.log(`📡 API State:`, JSON.stringify(state.data, null, 2));

    // 2. Checar Fetch Instances (às vezes mostra info diferente)
    const fetch = await axios.get(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: { apikey: API_KEY } });
    const instData = fetch.data.find((i: any) => i.instance.instanceName === instance.instanceName);
    console.log(`📋 Fetch Data:`, JSON.stringify(instData?.instance || "Not found", null, 2));
  } catch (e: any) {
    console.log("❌ Erro na API:", e.message);
  }
}

check();
