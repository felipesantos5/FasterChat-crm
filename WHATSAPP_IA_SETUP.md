# 🚀 Guia Completo: Configuração WhatsApp + IA

Este guia te ajudará a configurar e testar a integração completa do WhatsApp com IA no seu CRM.

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 18+ instalado
- Número de telefone para conectar no WhatsApp (não pode estar conectado no WhatsApp Web)
- Chaves de API da OpenAI ou Anthropic

---

## 1️⃣ Configuração Inicial

### 1.1 Clonar e Instalar Dependências

```bash
# Instalar dependências do backend
cd backend
npm install

# Instalar dependências do frontend
cd ../frontend
npm install
```

### 1.2 Configurar Variáveis de Ambiente

No arquivo `backend/.env`, certifique-se de ter:

```env
# API Configuration
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://crm_user:crm_password@localhost:5432/crm_db

# Evolution API (WhatsApp)
EVOLUTION_API_URL=http://localhost:8088
EVOLUTION_API_KEY=crm-api-key-secure-2024
EVOLUTION_SERVER_URL=http://localhost:8088

# Webhook Configuration
WEBHOOK_URL=http://host.docker.internal:3001
WEBHOOK_SECRET=your-webhook-secret-key

# AI Configuration
AI_PROVIDER=openai
OPENAI_API_KEY=sua-chave-openai-aqui
OPENAI_MODEL_MINI=gpt-4o-mini

# Opcional: Claude (Anthropic)
# ANTHROPIC_API_KEY=sua-chave-anthropic-aqui
# ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

---

## 2️⃣ Iniciar Serviços Docker

### 2.1 Criar Volume do Evolution API (primeira vez)

```bash
docker volume create evolution_instancesv2
```

### 2.2 Subir os Containers

```bash
docker-compose up -d
```

Verifique se os containers estão rodando:

```bash
docker-compose ps
```

Você deve ver:
- `crm_postgres` (rodando)
- `evolution_postgres` (rodando)
- `crm_redis` (rodando)
- `evolution_api` (rodando)

### 2.3 Verificar Logs da Evolution API

```bash
docker logs evolution_api -f
```

Aguarde até ver a mensagem: `Server started on port 8080`

---

## 3️⃣ Configurar Banco de Dados

### 3.1 Rodar Migrações do Prisma

```bash
cd backend
npx prisma migrate dev --name add_ai_advanced_settings
```

### 3.2 (Opcional) Visualizar Banco de Dados

```bash
npx prisma studio
```

---

## 4️⃣ Iniciar Backend e Frontend

### 4.1 Iniciar Backend

```bash
cd backend
npm run dev
```

Você deve ver:
```
🚀 Server running on port 3001
📊 Database connected successfully
```

### 4.2 Iniciar Frontend (em outro terminal)

```bash
cd frontend
npm run dev
```

Acesse: http://localhost:3000

---

## 5️⃣ Configurar WhatsApp no Dashboard

### 5.1 Fazer Login no CRM

1. Acesse http://localhost:3000
2. Faça login ou crie uma conta

### 5.2 Conectar WhatsApp

1. Navegue para **Configurações → WhatsApp**
2. Clique em **"Conectar WhatsApp"**
3. Um QR Code será exibido
4. Abra o WhatsApp no seu celular
5. Vá em **Configurações → Aparelhos conectados → Conectar um aparelho**
6. Escaneie o QR Code exibido na tela
7. Aguarde a confirmação de conexão ✅

**Status esperado:** "Conectado" (badge verde)

---

## 6️⃣ Configurar a IA

### 6.1 Base de Conhecimento

1. Navegue para **Configurações → IA**
2. Preencha os campos:

**Sobre sua empresa:**
```
Somos a TechStore, uma loja especializada em produtos de tecnologia.
Vendemos notebooks, celulares, acessórios e periféricos.
Atuamos há 10 anos no mercado e temos entrega para todo o Brasil.
```

**Produtos e Serviços:**
```
- MacBook Pro M3: R$ 15.999
- iPhone 15 Pro: R$ 9.499
- AirPods Pro: R$ 2.299
- Mouse Logitech MX Master 3: R$ 599
- Teclado Mecânico Keychron K2: R$ 899

Entrega: 2-5 dias úteis via Correios ou transportadora
Frete grátis acima de R$ 1.000
```

**Tom de Voz:**
```
Seja amigável, prestativo e use uma linguagem descontraída.
Use emojis quando apropriado.
Se apresente como "Assistente Virtual da TechStore".
Seja proativo em oferecer produtos relacionados.
```

**Políticas:**
```
- Garantia de 12 meses em todos os produtos
- Troca em até 7 dias (produto sem uso)
- Parcelamento em até 12x sem juros
- Aceitamos Pix, cartão e boleto
- Horário de atendimento humano: Seg-Sex 9h-18h
```

3. Clique em **"Salvar Agora"** ou aguarde o auto-save

### 6.2 Configurações Avançadas

Role até a seção **"Configurações Avançadas"**:

- **Resposta Automática:** ✅ ATIVADO
- **Provedor de IA:** OpenAI (GPT-4o Mini)
- **Criatividade (Temperature):** 0.7 (padrão)
- **Tamanho Máximo da Resposta:** 500 tokens

**Dica:** Para respostas mais criativas, aumente a temperatura para 0.8-0.9

---

## 7️⃣ Testar a Integração

### 7.1 Enviar Mensagem de Teste

1. **Do seu celular**, envie uma mensagem para o número que você conectou no WhatsApp
2. Exemplos de mensagens:

```
Olá!
```

```
Quais notebooks vocês têm disponíveis?
```

```
Qual o preço do iPhone 15 Pro?
```

```
Vocês fazem entrega em São Paulo?
```

### 7.2 Verificar Resposta Automática

A IA deve responder automaticamente em **menos de 5 segundos** ✨

### 7.3 Monitorar Logs (Backend)

No terminal do backend, você verá:

```
📩 Webhook received: { event: 'messages.upsert', instance: 'instance_...' }
Message processed successfully: uuid-da-mensagem
🤖 AI is enabled for this conversation, generating response...
[AIService] Generating response for customer: João Silva
[AIService] Using provider: openai
[AIService] Temperature: 0.7, Max tokens: 500
✓ AI response sent successfully
```

### 7.4 Verificar no Dashboard

1. Navegue para **Dashboard → Conversas**
2. Você deve ver a conversa com o cliente
3. Verifique se as mensagens estão aparecendo
4. Note que mensagens da IA têm o badge **"IA"**

---

## 8️⃣ Funcionalidades Avançadas

### 8.1 Desabilitar IA para uma Conversa

1. Acesse a conversa específica
2. Clique em **"Desabilitar IA"**
3. Atribua para um atendente humano
4. A IA não responderá mais automaticamente

### 8.2 Trocar Provedor de IA

Se quiser usar Claude (Anthropic):

1. Configure `ANTHROPIC_API_KEY` no `.env`
2. Em **Configurações → IA → Configurações Avançadas**
3. Mude o **Provedor de IA** para "Anthropic (Claude Sonnet)"
4. Salve

### 8.3 Ajustar Criatividade da IA

- **0.0 - 0.3:** Respostas muito conservadoras e previsíveis (ideal para suporte técnico)
- **0.4 - 0.7:** Balanceado (recomendado para a maioria dos casos)
- **0.8 - 1.0:** Respostas criativas e variadas (ideal para vendas)

---

## 9️⃣ Solução de Problemas

### ❌ QR Code não aparece

**Solução:**
```bash
# Reiniciar Evolution API
docker restart evolution_api

# Verificar logs
docker logs evolution_api -f
```

### ❌ IA não responde

**Checklist:**
1. Verificar se `OPENAI_API_KEY` está configurada corretamente
2. Em **Configurações → IA**, certificar que **Resposta Automática** está ATIVADA
3. Verificar logs do backend para erros
4. Testar manualmente a API da OpenAI:

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### ❌ Webhook não recebe mensagens

**Solução:**

1. Verificar se `WEBHOOK_URL` está correta no `.env`
2. Testar o endpoint manualmente:

```bash
curl http://localhost:3001/api/webhooks/whatsapp/test
```

Resposta esperada:
```json
{
  "success": true,
  "message": "Webhook endpoint is working",
  "timestamp": "2025-11-24T..."
}
```

3. Reconfigurar webhook:

```bash
# Desconectar e reconectar o WhatsApp no dashboard
```

### ❌ Containers não sobem

```bash
# Parar todos os containers
docker-compose down

# Limpar volumes (CUIDADO: apaga dados)
docker-compose down -v

# Recriar volume
docker volume create evolution_instancesv2

# Subir novamente
docker-compose up -d
```

---

## 🔟 Parâmetros Importantes da IA

### Para o Cliente Configurar:

| Parâmetro | O que faz | Valores | Recomendação |
|-----------|-----------|---------|--------------|
| **Resposta Automática** | Ativa/desativa IA | On/Off | **ON** |
| **Provedor** | Qual IA usar | OpenAI/Anthropic | **OpenAI** (mais barato) |
| **Temperature** | Criatividade | 0.0-1.0 | **0.7** (balanceado) |
| **Max Tokens** | Tamanho resposta | 100-2000 | **500** (1-2 parágrafos) |

### Informações da Base de Conhecimento:

1. **Sobre a Empresa:** História, missão, valores, diferenciais
2. **Produtos/Serviços:** Lista completa com preços e descrições
3. **Tom de Voz:** Como a IA deve se comunicar (formal/informal, emojis, etc)
4. **Políticas:** Prazos, garantias, formas de pagamento, horários

---

## 📊 Monitoramento

### Logs Importantes

**Backend (mensagens e IA):**
```bash
cd backend && npm run dev
```

**Evolution API (WhatsApp):**
```bash
docker logs evolution_api -f
```

**Banco de Dados:**
```bash
docker logs crm_postgres -f
```

### Métricas de Sucesso

✅ **Tempo de resposta da IA:** < 5 segundos
✅ **Taxa de resolução automática:** > 70%
✅ **Uptime do WhatsApp:** > 99%

---

## 🎉 Pronto!

Agora seu CRM está 100% funcional com WhatsApp + IA!

### Próximos Passos:

- [ ] Adicionar mais produtos/serviços na base de conhecimento
- [ ] Configurar exemplos de conversas (para treinar a IA)
- [ ] Testar com múltiplos clientes
- [ ] Ajustar temperatura conforme necessidade
- [ ] Configurar notificações para atendentes humanos
- [ ] Implementar horário comercial (IA só responde em horário configurado)

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do backend e Evolution API
2. Consulte a documentação da Evolution API: https://doc.evolution-api.com
3. Verifique se todas as variáveis de ambiente estão corretas
4. Teste cada componente isoladamente (DB, API, WhatsApp, IA)

**Boa sorte! 🚀**
