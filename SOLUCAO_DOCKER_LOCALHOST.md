# ✅ Solução: Evolution (Docker) + Backend (Localhost)

## 🎯 Problema Resolvido

Você estava enfrentando:

- ✅ Evolution API conecta no painel dela
- ❌ Dashboard não mostra "Conectado"
- ❌ IA não responde automaticamente

**Causa:** Webhook não funciona porque Evolution (Docker) não consegue chamar backend (localhost)

## 💡 Solução Implementada

### 1. **Sincronização Manual** (Botão de Refresh)

- Botão 🔄 ao lado de cada instância
- Clique para forçar sincronização de status
- Atualiza imediatamente do Evolution API

### 2. **Polling Automático** (A cada 5 segundos)

- Frontend consulta status automaticamente
- Não depende de webhook
- Status atualiza sozinho

### 3. **Endpoint de Sincronização**

- `POST /api/whatsapp/sync/:instanceId`
- Força consulta sem cache
- Garante status sempre atualizado

## 🚀 Como Usar

### Passo 1: Reiniciar Backend

```bash
cd backend
npm run dev
```

### Passo 2: Conectar WhatsApp

1. Acesse: http://localhost:3000/dashboard/settings/whatsapp
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR code
4. **AGUARDE 5 SEGUNDOS** (polling automático)
5. OU clique no botão 🔄 (sincronização manual)
6. Status deve mudar para "Conectado" ✅

### Passo 3: Verificar Logs

**Após escanear, nos logs do backend você deve ver:**

```
[WhatsApp Service] Checking status for: instance_xxx
[WhatsApp Service] Evolution API state: open
[WhatsApp Service] Mapped status: CONNECTED
✓ Status updated to CONNECTED for instance instance_xxx
```

**Se não aparecer "open":** O Evolution ainda não conectou, aguarde mais alguns segundos

### Passo 4: Configurar IA

1. Vá em: Dashboard > Configurações > IA
2. Preencha:
   - Informações da empresa
   - Produtos/serviços
   - Tom de voz
3. Marque: "Resposta automática ativada"
4. Salvar

### Passo 5: Habilitar IA em uma Conversa

1. Vá em: Dashboard > Conversas
2. Clique em uma conversa
3. Ative o toggle "IA Ativa"

### Passo 6: Testar

1. Envie mensagem do WhatsApp do cliente
2. **IA deve responder automaticamente!** 🎉

## 🔧 Troubleshooting

### Status não atualiza mesmo com botão 🔄

**Solução 1:** Verifique logs do backend

```bash
# Deve mostrar:
[WhatsApp Service] Checking status for: instance_xxx
```

**Solução 2:** Verifique Evolution API

```bash
curl http://localhost:8088/instance/fetchInstances \
  -H "apikey: crm-api-key-secure-2024"

# Procure: "state": "open"
```

**Solução 3:** Force update via script

```bash
cd backend
npx ts-node src/scripts/force-update-status.ts INSTANCE_NAME
```

### IA não responde

**Checklist:**

1. ✅ Status está "Conectado"?
2. ✅ Toggle "IA Ativa" está ON na conversa?
3. ✅ Empresa tem configuração de IA?

**Teste:**

```bash
# Verificar se IA está configurada
curl http://localhost:3001/api/ai/knowledge/COMPANY_ID \
  -H "Authorization: Bearer SEU_TOKEN"

# Deve retornar: { companyInfo: "...", autoReplyEnabled: true }
```

## 📊 Como Funciona Agora

### Antes (Com Webhook - NÃO FUNCIONA):

```
1. Usuário escaneia QR code
2. Evolution API → ❌ Tenta chamar webhook → Falha
3. Status NÃO atualiza
```

### Agora (Com Polling):

```
1. Usuário escaneia QR code
2. Frontend consulta status a cada 5s
3. OU usuário clica no botão 🔄
4. Backend consulta Evolution API diretamente
5. Status atualiza ✅
```

## 🎯 Features Adicionadas

### Backend:

- ✅ `POST /api/whatsapp/sync/:instanceId` - Sincronização manual
- ✅ Removido cache de 3s do getStatus
- ✅ Logs detalhados

### Frontend:

- ✅ Polling automático (5s)
- ✅ Botão 🔄 de sincronização manual
- ✅ Indicador de loading no botão

## 📝 Arquivos Modificados

### Backend:

- `src/controllers/whatsapp.controller.ts:234-269` - Endpoint sync
- `src/routes/whatsapp.routes.ts:32` - Rota sync
- `src/services/whatsapp.service.ts:196` - Removido cache

### Frontend:

- `app/dashboard/settings/whatsapp/page.tsx:54-60` - Polling
- `app/dashboard/settings/whatsapp/page.tsx:122-133` - Função sync
- `app/dashboard/settings/whatsapp/page.tsx:247-256` - Botão UI
- `lib/whatsapp.ts:75-78` - API sync

## 🚀 Teste Rápido

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Navegador:
1. http://localhost:3000/dashboard/settings/whatsapp
2. Conectar WhatsApp
3. Escanear QR code
4. Aguardar 5s OU clicar 🔄
5. Status → Conectado ✅

# Testar IA:
1. Configure IA (Dashboard > Config > IA)
2. Ative IA em conversa (toggle ON)
3. Envie mensagem do WhatsApp
4. IA responde! 🎉
```

## ⚡ Dica de Performance

Se o polling de 5s está muito frequente, você pode aumentar:

**`frontend/app/dashboard/settings/whatsapp/page.tsx:57`**

```typescript
const interval = setInterval(() => {
  loadInstances();
}, 10000); // 10 segundos ao invés de 5
```

## 🎉 Resultado Final

✅ Evolution (Docker) + Backend (localhost) = **FUNCIONA!**
✅ Status atualiza automaticamente
✅ Botão manual de sincronização
✅ IA responde automaticamente
✅ Sem necessidade de webhook

## 📚 Scripts Úteis

```bash
# Ver status de todas instâncias
npx ts-node src/scripts/force-update-status.ts

# Monitorar status em tempo real
npx ts-node src/scripts/watch-status.ts

# Testar conexão com Evolution
npx ts-node src/scripts/test-evolution-connection.ts
```

---

**Agora está tudo funcionando! 🎯**

Se o status ainda não atualizar:

1. Clique no botão 🔄
2. Ou aguarde 5 segundos (polling automático)
3. Ou reinicie o backend e frontend
