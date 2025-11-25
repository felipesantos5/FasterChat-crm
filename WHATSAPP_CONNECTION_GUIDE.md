# Guia de Conexão WhatsApp com Evolution API

## Problemas Corrigidos

### ✅ Implementações Realizadas

1. **Webhook para eventos de conexão** (`backend/src/controllers/webhook.controller.ts:122-240`)

   - Handler para `connection.update` - atualiza status quando WhatsApp conecta/desconecta
   - Handler para `qrcode.updated` - atualiza QR code automaticamente
   - Logs detalhados para debug

2. **Eventos configurados no webhook** (`backend/src/services/whatsapp.service.ts:428-447`)

   - `CONNECTION_UPDATE` - crítico para status de conexão
   - `QRCODE_UPDATED` - atualização automática do QR code
   - `STATUS_INSTANCE` - status da instância
   - `MESSAGES_UPSERT` - mensagens recebidas
   - `SEND_MESSAGE` - mensagens enviadas

3. **Resposta automática da IA** (`backend/src/controllers/webhook.controller.ts:79-96`)
   - Gera resposta usando contexto da empresa
   - Envia automaticamente quando `aiEnabled = true`
   - Usa histórico de conversas para contexto

## Fluxo Completo de Conexão

### 1️⃣ Criar Instância

```
POST /api/whatsapp/instances
{
  "companyId": "uuid-da-empresa"
}
```

**O que acontece:**

- Cria instância na Evolution API
- Configura webhook automaticamente
- Retorna QR code inicial
- Status: `CONNECTING`

### 2️⃣ Escanear QR Code

- Abra WhatsApp no celular
- Vá em: **Dispositivos Conectados** → **Conectar Dispositivo**
- Escaneie o QR code exibido no frontend

**O que acontece automaticamente:**

1. Evolution API detecta o scan
2. Envia webhook `CONNECTION_UPDATE` com `state: "open"`
3. Backend atualiza status → `CONNECTED`
4. QR code é limpo do banco
5. Número de telefone é extraído e salvo

### 3️⃣ Receber Mensagens e IA Responder

Quando uma mensagem chega:

1. Evolution API → Webhook `MESSAGES_UPSERT`
2. Backend salva mensagem no banco
3. Verifica se `aiEnabled = true` na conversa
4. **Se SIM:**
   - Busca histórico de mensagens
   - Busca configurações da IA da empresa
   - Gera resposta usando OpenAI/Claude
   - Envia resposta automaticamente
5. **Se NÃO:**
   - Apenas salva a mensagem
   - Aguarda atendimento humano

## Verificação de Status

### Verificar se webhook está funcionando

```bash
# 1. Verificar logs do backend
# Você deve ver:
📩 Webhook received: { event: 'connection.update', instance: '...', data: {...} }

# 2. Testar endpoint de webhook
curl http://localhost:3001/api/webhooks/whatsapp/test
# Response: { success: true, message: 'Webhook endpoint is working' }
```

### Verificar status da instância

```
GET /api/whatsapp/instances/:instanceId/status
```

**Possíveis status:**

- `CONNECTING` - Aguardando scan do QR code
- `CONNECTED` - WhatsApp conectado e funcionando
- `DISCONNECTED` - Desconectado (precisa reconectar)

## Troubleshooting

### ❌ Problema: QR code aparece mas não conecta após scan

**Verificações:**

1. **Backend está rodando?**

   ```bash
   # Deve estar rodando na porta 3001
   curl http://localhost:3001/api/webhooks/whatsapp/test
   ```

2. **Evolution API está acessível pelo backend?**

   ```bash
   # Verifique o .env
   EVOLUTION_API_URL=http://localhost:8088
   # Teste conexão
   curl http://localhost:8088
   ```

3. **Webhook está configurado corretamente?**

   - Verifique `WEBHOOK_URL` no `.env`
   - Deve apontar para o backend: `http://host.docker.internal:3001` (Docker)
   - Ou `http://localhost:3001` (local)
   - **IMPORTANTE:** Se Evolution está em Docker, use `host.docker.internal`

4. **Verifique logs do backend após escanear:**

   ```
   Deve aparecer:
   📩 Webhook received: { event: 'connection.update', ... }
   🔌 Connection update received: { state: 'open' }
   ✅ WhatsApp connected successfully!
   ✓ Status updated to CONNECTED for instance ...
   ```

5. **Se não aparecer nenhum log:**
   - Webhook não está chegando
   - Verifique URL do webhook na Evolution API
   - Certifique-se que a porta 3001 está acessível

### ❌ Problema: IA não responde automaticamente

**Verificações:**

1. **IA está habilitada para a conversa?**

   ```sql
   SELECT ai_enabled FROM conversations WHERE customer_id = '...';
   -- Deve retornar: true
   ```

2. **Chave da OpenAI está configurada?**

   ```bash
   # Verifique .env
   ```

3. **Empresa tem configuração de IA?**

   ```sql
   SELECT * FROM ai_knowledge WHERE company_id = '...';
   -- Deve ter pelo menos um registro
   ```

4. **Verifique logs ao receber mensagem:**
   ```
   📩 Webhook received: { event: 'messages.upsert', ... }
   Message processed successfully: ...
   🤖 AI is enabled for this conversation, generating response...
   [AIService] Generating response for customer: ...
   ✓ AI response sent successfully
   ```

### ❌ Problema: Evolution API não envia webhooks

**Soluções:**

1. **Reconfigurar webhook manualmente:**

   ```bash
   curl -X POST "http://localhost:8088/webhook/set/INSTANCE_NAME" \
     -H "apikey: crm-api-key-secure-2024" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "http://host.docker.internal:3001/api/webhooks/whatsapp",
       "enabled": true,
       "events": ["CONNECTION_UPDATE", "QRCODE_UPDATED", "MESSAGES_UPSERT"]
     }'
   ```

2. **Verificar webhook configurado:**

   ```bash
   curl "http://localhost:8088/webhook/find/INSTANCE_NAME" \
     -H "apikey: crm-api-key-secure-2024"
   ```

3. **Recriar instância:**
   - Delete a instância atual
   - Crie uma nova
   - O webhook será configurado automaticamente

## Configuração do .env

### Backend `.env` essencial:

```bash
# API
API_URL=http://localhost:3001

# Evolution API
EVOLUTION_API_URL=http://localhost:8088
EVOLUTION_API_KEY=crm-api-key-secure-2024

# Webhook - CRÍTICO!
# Se Evolution em Docker: use host.docker.internal
# Se Evolution local: use localhost
WEBHOOK_URL=http://host.docker.internal:3001
WEBHOOK_SECRET=your-webhook-secret-key

# OpenAI para IA
```

## Testando Fluxo Completo

### 1. Criar instância e conectar

```bash
# 1. Criar instância
curl -X POST http://localhost:3001/api/whatsapp/instances \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "uuid-da-empresa"}'

# 2. Pegar QR code
# (Abrir no frontend ou via API)

# 3. Escanear com WhatsApp

# 4. Aguardar 2-3 segundos

# 5. Verificar status
curl http://localhost:3001/api/whatsapp/instances/INSTANCE_ID/status \
  -H "Authorization: Bearer SEU_TOKEN"

# Deve retornar: { status: "CONNECTED" }
```

### 2. Testar IA automática

```bash
# 1. Habilitar IA para um customer
curl -X POST http://localhost:3001/api/conversations/toggle-ai \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "uuid-do-customer", "aiEnabled": true}'

# 2. Enviar mensagem teste do WhatsApp do cliente
# "Olá, gostaria de informações sobre seus produtos"

# 3. Verificar logs do backend
# Deve mostrar:
# - Mensagem recebida
# - IA gerando resposta
# - Resposta enviada

# 4. Verificar no frontend
# Deve aparecer a resposta da IA com badge "IA"
```

## Logs Importantes

### Conexão bem-sucedida:

```
📩 Webhook received: { event: 'connection.update', instance: 'instance_xxx' }
🔌 Connection update received: { state: 'open' }
✅ WhatsApp connected successfully!
✓ Status updated to CONNECTED for instance instance_xxx
```

### Mensagem recebida e IA respondendo:

```
📩 Webhook received: { event: 'messages.upsert', instance: 'instance_xxx' }
Message processed successfully: msg_uuid
🤖 AI is enabled for this conversation, generating response...
[AIService] Generating response for customer: João Silva
[AIService] Using provider: openai
[AIService] Temperature: 0.7, Max tokens: 500
[AIService] Response generated successfully
✓ AI response sent successfully
```

## Próximos Passos

- [ ] Implementar fine-tuning com dados de feedback
- [ ] Adicionar suporte para imagens/áudio
- [ ] Implementar fila de mensagens (Bull/Redis)
- [ ] Adicionar rate limiting para IA
- [ ] Metrics e dashboard de performance
