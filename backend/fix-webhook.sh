#!/bin/bash

# Script para reconfigurar webhook da Evolution API

# Configurações
EVOLUTION_URL="http://localhost:8088"
EVOLUTION_API_KEY="crm-api-key-secure-2024"
WEBHOOK_URL="http://host.docker.internal:3001/api/webhooks/whatsapp"

# Pede o nome da instância
echo "🔧 Reconfigurar Webhook da Evolution API"
echo ""
read -p "Digite o nome da instância (ex: instance_123): " INSTANCE_NAME

if [ -z "$INSTANCE_NAME" ]; then
  echo "❌ Nome da instância não pode ser vazio!"
  exit 1
fi

echo ""
echo "📋 Configurações:"
echo "   Evolution URL: $EVOLUTION_URL"
echo "   Instance: $INSTANCE_NAME"
echo "   Webhook URL: $WEBHOOK_URL"
echo ""

# Configurar webhook
echo "🔄 Configurando webhook..."
curl -X POST "$EVOLUTION_URL/webhook/set/$INSTANCE_NAME" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"enabled\": true,
    \"webhook_by_events\": false,
    \"webhook_base64\": false,
    \"events\": [
      \"MESSAGES_UPSERT\",
      \"MESSAGES_UPDATE\",
      \"CONNECTION_UPDATE\",
      \"QRCODE_UPDATED\",
      \"STATUS_INSTANCE\",
      \"SEND_MESSAGE\"
    ],
    \"webhook_headers\": {
      \"X-Webhook-Secret\": \"your-webhook-secret-key\"
    }
  }"

echo ""
echo ""
echo "✅ Webhook reconfigurado!"
echo ""

# Verificar configuração
echo "🔍 Verificando configuração..."
curl "$EVOLUTION_URL/webhook/find/$INSTANCE_NAME" \
  -H "apikey: $EVOLUTION_API_KEY"

echo ""
echo ""
echo "📝 Próximos passos:"
echo "   1. Verifique se o webhook está com URL correta acima"
echo "   2. Teste enviando uma mensagem do WhatsApp"
echo "   3. Verifique os logs do backend (npm run dev)"
