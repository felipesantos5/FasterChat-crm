# FasterChat — Contexto do Projeto

Sistema SaaS multi-tenant de CRM + atendimento de IA + automação de fluxos via WhatsApp, focado em empresas que querem automatizar o atendimento e ter uma visão de clara de um CRM e funil de vendas. O core do produto é a integração com WhatsApp via Evolution API.

---

## Stack

### Backend
- **Runtime:** Node.js + TypeScript (strict mode)
- **Framework:** Express
- **ORM:** Prisma + PostgreSQL
- **Deploy:** Docker Compose no Coolify (VPS)
- **WhatsApp:** Evolution API v2.3.6

### Frontend
- **Framework:** React + TypeScript + Vite
- **UI:** shadcn/ui (componentes base de toda a interface)
- **Estilo:** Tailwind CSS

---

## Regras de Código — SEMPRE seguir

### Geral
- TypeScript strict — **nunca usar `any`**, sempre tipar explicitamente
- Código funcional e direto — foco na funcionalidade, sem over-engineering
- **Nunca adicionar `console.log` para debug** — apenas `console.error` em blocos de catch para erros reais
- Tratar erros explicitamente — nunca deixar try/catch vazio
- Sem código comentado desnecessário — se não está sendo usado, remove
- Nomear variáveis em inglês, comentários e mensagens de erro podem ser em português

### Backend
- Sempre tipificar o retorno das funções e os parâmetros
- **Todo acesso ao banco deve filtrar por `tenantId`** — o sistema é multi-tenant
- Usar Prisma para todas as queries — sem SQL raw, exceto quando absolutamente necessário
- Nunca commitar ou expor variáveis de ambiente — usar sempre `process.env`
- Validar inputs nas rotas antes de chegar nos services
- Separar responsabilidades: routes → controllers → services → prisma

### Frontend
- Componentes funcionais com hooks — sem class components
- Usar **shadcn/ui** como base para todos os elementos de UI
- Seguir o padrão visual que já existe no projeto — não inventar novos patterns de layout
- UI/UX deve ser intuitiva — ações primárias claras, feedback visual nas operações
- Formulários com React Hook Form + Zod (padrão do projeto com shadcn)
- Estados de loading, erro e sucesso sempre tratados na interface

---

## Estrutura de Pastas

### Backend
```
/src
  /routes         ← definição das rotas Express
  /controllers    ← recebe req/res, chama services
  /services       ← lógica de negócio
  /middlewares    ← auth, validação, etc
  /utils          ← helpers reutilizáveis
  /types          ← interfaces e tipos TypeScript
/prisma
  schema.prisma   ← schema do banco
  /migrations     ← migrations geradas pelo Prisma
```

### Frontend
```
/src
  /components     ← componentes reutilizáveis
    /ui           ← componentes shadcn (não editar manualmente)
  /pages          ← páginas/rotas da aplicação
  /hooks          ← custom hooks
  /services       ← chamadas para a API
  /types          ← interfaces TypeScript
  /lib            ← utilitários e configurações
```

---

## Comandos Principais

### Backend
```bash
npm run dev          # inicia em modo desenvolvimento
npm run build        # build TypeScript
npx prisma migrate dev --name <nome>   # criar migration
npx prisma generate  # regenerar client após mudança no schema
npx prisma studio    # interface visual do banco
```

### Frontend
```bash
npm run dev          # inicia em modo desenvolvimento (Vite)
npm run build        # build de produção
```

### Docker / Deploy
```bash
docker compose up -d        # subir containers
docker compose logs -f      # acompanhar logs
docker compose down         # parar containers
```

---

## Evolution API v2.3.6 — Referência Completa

**Base URL:** `https://{evolution-host}`  
**Auth:** Header `apikey: {API_KEY}` em todas as requisições

### Instâncias

```
POST   /instance/create        ← criar nova instância WhatsApp
GET    /instance/fetchInstances ← listar instâncias
GET    /instance/connect/{instance}   ← conectar / obter QR code
GET    /instance/connectionState/{instance}  ← estado da conexão: open | close | connecting
PUT    /instance/restart/{instance}   ← reiniciar instância
DELETE /instance/logout/{instance}    ← deslogar (mantém instância)
DELETE /instance/delete/{instance}    ← deletar instância completamente
POST   /instance/setPresence/{instance}  ← definir presença: available | unavailable
```

**Estados de conexão:** `open` (conectado) | `close` (desconectado) | `connecting` (aguardando QR)

### Envio de Mensagens

```
POST /message/sendText/{instance}
Body: {
  "number": "5511999999999",   ← DDD + número, sem + ou espaços
  "text": "mensagem aqui",
  "delay": 1000                ← delay em ms antes de enviar (opcional)
}

POST /message/sendMedia/{instance}
Body: {
  "number": "5511999999999",
  "mediatype": "image" | "video" | "audio" | "document",
  "media": "https://url.com/file.jpg",  ← URL pública ou base64
  "caption": "legenda",
  "fileName": "arquivo.pdf"   ← obrigatório para document
}

POST /message/sendWhatsAppAudio/{instance}
Body: {
  "number": "5511999999999",
  "audio": "base64_ou_url",   ← envia como áudio de voz (PTT)
  "encoding": true
}

POST /message/sendLocation/{instance}
Body: {
  "number": "5511999999999",
  "latitude": -23.5505,
  "longitude": -46.6333,
  "name": "Nome do Local",
  "address": "Endereço"
}

POST /message/sendContact/{instance}
Body: {
  "number": "5511999999999",
  "contact": [{ "fullName": "Nome", "wuid": "5511888888888", "phoneNumber": "11888888888" }]
}

POST /message/sendReaction/{instance}
Body: {
  "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false, "id": "MESSAGE_ID" },
  "reaction": "👍"
}

POST /message/sendList/{instance}
Body: {
  "number": "5511999999999",
  "title": "Título",
  "description": "Descrição",
  "buttonText": "Ver opções",
  "footerText": "Rodapé",
  "sections": [{
    "title": "Seção 1",
    "rows": [{ "title": "Opção 1", "description": "desc", "rowId": "1" }]
  }]
}

POST /message/sendButtons/{instance}
Body: {
  "number": "5511999999999",
  "title": "Título",
  "description": "Texto",
  "footer": "Rodapé",
  "buttons": [{ "type": "reply", "displayText": "Sim", "id": "btn_sim" }]
}

POST /message/sendPoll/{instance}
Body: {
  "number": "5511999999999",
  "name": "Pergunta da enquete",
  "selectableCount": 1,
  "values": ["Opção A", "Opção B", "Opção C"]
}
```

### Gerenciamento de Mensagens

```
POST   /chat/markMessageAsRead/{instance}
Body:  { "readMessages": [{ "id": "MSG_ID", "fromMe": false, "remoteJid": "5511999@s.whatsapp.net" }] }

POST   /chat/markMessageAsUnread/{instance}

DELETE /message/delete/{instance}
Body:  { "id": "MSG_ID", "fromMe": true, "remoteJid": "5511999@s.whatsapp.net", "participant": "" }

POST   /chat/archiveChat/{instance}
Body:  { "chat": "5511999999999@s.whatsapp.net", "archive": true }
```

### Verificação e Contatos

```
POST /misc/checkIsWhatsapp/{instance}
Body: { "numbers": ["5511999999999", "5511888888888"] }
Retorna: [{ "jid": "5511999@s.whatsapp.net", "exists": true }]

GET  /chat/findContacts/{instance}
GET  /chat/findChats/{instance}
GET  /chat/findMessages/{instance}?where[key][remoteJid]=5511999@s.whatsapp.net
```

### Webhook

```
POST /webhook/set/{instance}
Body: {
  "enabled": true,
  "url": "https://seu-backend.com/webhook/evolution",
  "webhookByEvents": false,
  "webhookBase64": false,
  "events": [
    "MESSAGES_UPSERT",    ← mensagem recebida (principal para IA)
    "MESSAGES_UPDATE",    ← atualização de status (lido, entregue)
    "MESSAGES_DELETE",    ← mensagem deletada
    "SEND_MESSAGE",       ← confirmação de envio
    "CONNECTION_UPDATE",  ← estado da conexão mudou
    "QRCODE_UPDATED",     ← novo QR code gerado
    "PRESENCE_UPDATE",    ← online/offline/digitando
    "CONTACTS_UPSERT",    ← contato atualizado
    "CHATS_UPSERT"        ← conversa nova ou atualizada
  ]
}

GET /webhook/find/{instance}   ← consultar webhook configurado
```

**Payload do evento MESSAGES_UPSERT (mensagem recebida):**
```json
{
  "event": "messages.upsert",
  "instance": "nome-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MESSAGE_ID"
    },
    "pushName": "Nome do Contato",
    "message": {
      "conversation": "texto da mensagem",
      "extendedTextMessage": { "text": "texto com formatação" },
      "imageMessage": { "caption": "legenda" },
      "audioMessage": {},
      "documentMessage": { "fileName": "arquivo.pdf" }
    },
    "messageType": "conversation",
    "messageTimestamp": 1699999999,
    "instanceId": "uuid-da-instancia"
  }
}
```

**Para extrair o texto da mensagem recebida:**
```typescript
const msg = data.message;
const text = msg.conversation 
  || msg.extendedTextMessage?.text 
  || msg.imageMessage?.caption 
  || '';
const from = data.key.remoteJid; // "5511999999999@s.whatsapp.net"
const isFromMe = data.key.fromMe;
const senderPhone = from.replace('@s.whatsapp.net', '');
```

**Payload do evento CONNECTION_UPDATE:**
```json
{
  "event": "connection.update",
  "instance": "nome-instancia",
  "data": {
    "state": "open",       ← "open" | "close" | "connecting"
    "statusReason": 200
  }
}
```

### Grupos

```
POST /group/create/{instance}
Body: { "subject": "Nome do Grupo", "participants": ["5511999999999"] }

GET  /group/fetchAllGroups/{instance}?getParticipants=false

POST /group/updateParticipant/{instance}
Body: { "groupJid": "GRUPO@g.us", "action": "add" | "remove" | "promote" | "demote", "participants": ["5511@s.whatsapp.net"] }
```

### Formato dos JIDs (identificadores WhatsApp)
- Contato individual: `5511999999999@s.whatsapp.net`
- Grupo: `120363XXXXXXXX@g.us`
- Status/broadcast: `status@broadcast`
- Sempre usar o formato com `@s.whatsapp.net` ao enviar mensagens para pessoas

---

## Regras de Integração com Evolution API

- **Nunca** usar `+` no número de telefone — formato: `5511999999999` (país + DDD + número)
- Verificar sempre com `checkIsWhatsapp` antes de enviar a primeiro contato
- Tratar o evento `CONNECTION_UPDATE` para saber se a instância caiu e reconectar
- O evento principal para receber mensagens é `MESSAGES_UPSERT`
- Ignorar mensagens com `fromMe: true` no handler de IA para não criar loop
- `remoteJid` para grupos termina em `@g.us` — tratar diferente de contatos individuais
- Respeitar delays entre mensagens em sequência para não ser banido
- Para áudio PTT (mensagem de voz), usar `sendWhatsAppAudio` com `encoding: true`

---

## Arquitetura do Sistema

- **Multi-tenant:** toda query ao banco filtra por `tenantId` — sem exceção
- **Fluxo de mensagem recebida:**
  1. Webhook da Evolution API chega no backend
  2. Identificar tenant pela instância do WhatsApp
  3. Verificar se tem atendimento humano ativo ou IA
  4. Se IA: processar com modelo e responder
  5. Se humano: registrar no CRM e notificar operador
- **Atendimento IA:** roteamento por complexidade da mensagem (modelo simples → avançado)
- **Fluxos de automação:** sequências de mensagens disparadas por triggers

---

## Avisos Importantes

- **NUNCA commitar `.env`** — usar `.env.example` com valores de exemplo
- Não alterar a lógica de roteamento de IA sem revisar o impacto nos custos
- Instâncias WhatsApp são por tenant — cada cliente tem sua própria instância
- Coolify/Docker: variáveis de ambiente são configuradas no painel do Coolify, não no compose
- Migrations Prisma: sempre revisar o SQL gerado antes de rodar em produção

---

## Contexto Adicional para a Evolution API

Para ter contexto mais profundo e atualizado sobre a Evolution API durante o desenvolvimento, referencie os seguintes documentos:

- **Documentação oficial v2:** https://doc.evolution-api.com/v2/en/get-started/introduction
- **Referência da API (endpoints):** https://doc.evolution-api.com/v2/api-reference/get-information
- **GitHub oficial:** https://github.com/EvolutionAPI/evolution-api

> **Dica para Claude Code:** Se precisar de detalhes de um endpoint específico da Evolution API que não estão neste arquivo, consulte a documentação oficial acima antes de implementar.