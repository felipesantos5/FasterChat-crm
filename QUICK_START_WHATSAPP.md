# 🚀 Quick Start - WhatsApp + IA Automática

## ✅ O Que Foi Corrigido

### Problema Anterior:

- QR code era gerado, mas após escanear o status não mudava para CONNECTED
- IA não respondia automaticamente

### Solução Implementada:

1. ✅ Webhook agora processa eventos `CONNECTION_UPDATE` e `QRCODE_UPDATED`
2. ✅ Status atualiza automaticamente após scan do QR code
3. ✅ IA responde automaticamente quando `aiEnabled = true`
4. ✅ Logs detalhados para debug

## 📋 Pré-requisitos

```bash
# 1. Evolution API rodando
docker-compose up evolution-api -d

# 2. PostgreSQL rodando
# (ou use o docker-compose)

# 3. Backend rodando
cd backend
npm run dev

# 4. Frontend rodando (opcional, para UI)
cd frontend
npm run dev
```

## 🔧 Configuração do .env

### Backend `.env` - IMPORTANTE!

```bash
# Evolution API
EVOLUTION_API_URL=http://localhost:8088
EVOLUTION_API_KEY=crm-api-key-secure-2024

# Webhook - CRÍTICO para status de conexão funcionar!
# Se Evolution em Docker: use host.docker.internal
# Se Evolution local: use localhost
WEBHOOK_URL=http://host.docker.internal:3001

# OpenAI (para IA automática)
```

## 🎯 Passo a Passo

### 1️⃣ Testar Conexão com Evolution API

```bash
cd backend
npx ts-node src/scripts/test-evolution-connection.ts
```

**Deve mostrar:**

```
✅ Evolution API está online!
✅ Autenticação OK!
✅ Backend está acessível para webhooks!
```

### 2️⃣ Criar Instância WhatsApp

**Via API:**

```bash
curl -X POST http://localhost:3001/api/whatsapp/instances \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyId": "uuid-da-empresa"}'
```

**Ou via Frontend:**

- Acesse: http://localhost:3000/dashboard/settings/whatsapp
- Clique em "Conectar WhatsApp"

### 3️⃣ Escanear QR Code

1. Abra o QR code (frontend ou via API)
2. No WhatsApp do celular:
   - **Dispositivos Conectados** → **Conectar Dispositivo**
   - Escaneie o código

### 4️⃣ Verificar Logs do Backend

**Você DEVE ver esses logs após escanear:**

```
📩 Webhook received: { event: 'connection.update', instance: '...' }
🔌 Connection update received: { state: 'open' }
✅ WhatsApp connected successfully!
✓ Status updated to CONNECTED for instance ...
```

**Se NÃO aparecer:**

- Problema no webhook
- Veja seção Troubleshooting abaixo ⬇️

### 5️⃣ Configurar IA para Resposta Automática

**Via API:**

```bash
# 1. Configurar conhecimento da IA
curl -X POST http://localhost:3001/api/ai/knowledge \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyInfo": "Somos uma empresa de tecnologia...",
    "productsServices": "Vendemos software...",
    "toneInstructions": "Seja profissional e educado",
    "autoReplyEnabled": true
  }'

# 2. Habilitar IA para uma conversa
curl -X POST http://localhost:3001/api/conversations/toggle-ai \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "uuid-do-cliente",
    "aiEnabled": true
  }'
```

**Ou via Frontend:**

- Configurações > IA > Preencher formulário
- Conversas > Clicar em conversa > Toggle "IA Ativa"

### 6️⃣ Testar Resposta Automática

1. Envie mensagem do WhatsApp do cliente:

   ```
   "Olá, gostaria de informações sobre seus produtos"
   ```

2. Verifique logs do backend:

   ```
   📩 Webhook received: { event: 'messages.upsert' }
   Message processed successfully: ...
   🤖 AI is enabled for this conversation, generating response...
   [AIService] Generating response for customer: João Silva
   ✓ AI response sent successfully
   ```

3. Cliente recebe resposta automática da IA! 🎉

## 🐛 Troubleshooting

### ❌ Status não muda para CONNECTED após scan

**Causa:** Webhook não está chegando ao backend

**Soluções:**

1. **Verifique WEBHOOK_URL no .env:**

   ```bash
   # Se Evolution em Docker:
   WEBHOOK_URL=http://host.docker.internal:3001

   # Se Evolution local:
   WEBHOOK_URL=http://localhost:3001
   ```

2. **Teste se backend está acessível:**

   ```bash
   curl http://localhost:3001/api/webhooks/whatsapp/test
   # Deve retornar: { "success": true, ... }
   ```

3. **Reconfigurar webhook manualmente:**

   ```bash
   curl -X POST "http://localhost:8088/webhook/set/INSTANCE_NAME" \
     -H "apikey: crm-api-key-secure-2024" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "http://host.docker.internal:3001/api/webhooks/whatsapp",
       "enabled": true,
       "events": ["CONNECTION_UPDATE", "MESSAGES_UPSERT"]
     }'
   ```

4. **Verificar webhook configurado:**
   ```bash
   curl "http://localhost:8088/webhook/find/INSTANCE_NAME" \
     -H "apikey: crm-api-key-secure-2024"
   ```

### ❌ IA não responde automaticamente

**Checklist:**

1. ✅ OpenAI API key configurada no .env?

   ```bash
   echo $OPENAI_API_KEY
   ```

2. ✅ IA habilitada para a conversa?

   ```sql
   SELECT ai_enabled FROM conversations WHERE customer_id = '...';
   ```

3. ✅ Empresa tem configuração de IA?

   ```sql
   SELECT * FROM ai_knowledge WHERE company_id = '...';
   ```

4. ✅ `autoReplyEnabled = true` na configuração?

   ```sql
   SELECT auto_reply_enabled FROM ai_knowledge WHERE company_id = '...';
   ```

5. ✅ Logs aparecem?
   - Deve aparecer: `🤖 AI is enabled for this conversation`
   - Se aparecer: `ℹ️ AI disabled` → IA está desabilitada

### ❌ Evolution API não está online

```bash
# Se estiver usando Docker:
docker-compose up evolution-api -d

# Verificar logs:
docker-compose logs evolution-api

# Testar manualmente:
curl http://localhost:8088
```

## 📊 Monitoramento

### Ver logs em tempo real:

```bash
# Backend
cd backend
npm run dev

# Ver apenas webhooks:
npm run dev | grep "Webhook"
```

### Verificar status da instância:

```bash
curl http://localhost:3001/api/whatsapp/instances/INSTANCE_ID/status \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Ver estatísticas de feedback da IA:

- Frontend: Dashboard > IA > Insights
- API: `GET /api/messages/feedback/stats/:companyId`

## 🎯 Resumo do Fluxo

```
1. Usuário cria instância
   ↓
2. Backend gera QR code
   ↓
3. Usuário escaneia
   ↓
4. Evolution API → Webhook CONNECTION_UPDATE
   ↓
5. Backend atualiza status → CONNECTED ✅
   ↓
6. Cliente envia mensagem
   ↓
7. Evolution API → Webhook MESSAGES_UPSERT
   ↓
8. Backend salva mensagem
   ↓
9. Verifica aiEnabled = true
   ↓
10. Gera resposta com IA
    ↓
11. Envia resposta automática ✅
```

## 📚 Arquivos Criados/Modificados

### Backend:

- `src/controllers/webhook.controller.ts:122-240` - Handlers de conexão
- `src/services/whatsapp.service.ts:428-447` - Config de eventos
- `src/types/message.ts:51-61` - Tipos para webhooks
- `src/scripts/test-evolution-connection.ts` - Script de teste

### Documentação:

- `WHATSAPP_CONNECTION_GUIDE.md` - Guia completo
- `QUICK_START_WHATSAPP.md` - Este arquivo

## 🔗 Links Úteis

- Evolution API Docs: https://doc.evolution-api.com/
- OpenAI API: https://platform.openai.com/
- Frontend local: http://localhost:3000
- Backend local: http://localhost:3001
- Evolution API: http://localhost:8088

## ✨ Próximos Passos

- [ ] Adicionar suporte para imagens/áudio
- [ ] Implementar fila de mensagens (Bull/Redis)
- [ ] Fine-tuning com dados de feedback
- [ ] Métricas de performance da IA
- [ ] Templates de respostas rápidas
