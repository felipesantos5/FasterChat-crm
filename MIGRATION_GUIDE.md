# 🔄 Guia de Migração - Configurações Avançadas da IA

## ⚠️ IMPORTANTE: Execute Antes de Testar as Configurações Avançadas

As configurações avançadas da IA (provider, temperature, maxTokens, autoReplyEnabled) precisam ser adicionadas ao banco de dados.

---

## 🚀 Passo a Passo

### 1. Parar o Backend (se estiver rodando)

```bash
# Pressione Ctrl+C no terminal do backend
```

### 2. Navegar até a pasta do backend

```bash
cd C:\Users\felip\Desktop\crm\backend
```

### 3. Gerar e Aplicar a Migração

```bash
npx prisma migrate dev --name add_ai_advanced_settings
```

**O que esse comando faz:**
- Compara o schema atual (`prisma/schema.prisma`) com o banco de dados
- Cria um arquivo SQL com as alterações necessárias
- Aplica as alterações no banco de dados
- Atualiza o Prisma Client

### 4. Verificar se foi criado

Você deve ver uma mensagem parecida com:

```
Applying migration `20251124XXXXXX_add_ai_advanced_settings`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20251124XXXXXX_add_ai_advanced_settings/
    └─ migration.sql

✔ Generated Prisma Client
```

### 5. Reiniciar o Backend

```bash
npm run dev
```

---

## 🔍 O que Foi Adicionado ao Banco

Novas colunas na tabela `ai_knowledge`:

| Coluna | Tipo | Padrão | Descrição |
|--------|------|--------|-----------|
| `provider` | TEXT | 'openai' | Provedor de IA (openai/anthropic) |
| `model` | TEXT | NULL | Modelo específico (opcional) |
| `temperature` | DOUBLE | 0.7 | Criatividade (0.0 a 1.0) |
| `maxTokens` | INTEGER | 500 | Tamanho máximo da resposta |
| `autoReplyEnabled` | BOOLEAN | true | Resposta automática ativada |

---

## ✅ Testando se Funcionou

### 1. Verificar no Prisma Studio

```bash
npx prisma studio
```

1. Abra http://localhost:5555
2. Clique em `AIKnowledge`
3. Você deve ver as novas colunas: `provider`, `temperature`, `maxTokens`, etc.

### 2. Testar no Frontend

1. Acesse http://localhost:3000/dashboard/settings/ai
2. Altere as configurações avançadas:
   - Mude a temperatura para 0.8
   - Mude maxTokens para 700
   - Clique em "Salvar Agora"
3. Recarregue a página
4. As configurações devem estar salvas! ✅

### 3. Verificar nos Logs do Backend

No terminal do backend, após salvar, você deve ver:

```
[AI Knowledge Controller] Updating knowledge with advanced settings: {
  companyId: 'xxx',
  provider: 'openai',
  temperature: 0.8,
  maxTokens: 700,
  autoReplyEnabled: true
}

[AI Knowledge Service] Upserting knowledge with data: { ... }

✓ AI knowledge updated for company xxx {
  provider: 'openai',
  temperature: 0.8,
  maxTokens: 700,
  autoReplyEnabled: true
}
```

---

## 🐛 Troubleshooting

### ❌ Erro: "No pending migrations"

**Causa:** O Prisma não detectou alterações

**Solução:**
1. Verifique se o `schema.prisma` está correto
2. Force a criação da migração:

```bash
npx prisma migrate dev --name add_ai_advanced_settings --create-only
```

Isso cria o arquivo SQL sem aplicar. Depois aplique:

```bash
npx prisma migrate deploy
```

### ❌ Erro: "Column already exists"

**Causa:** As colunas já foram criadas manualmente

**Solução:**
1. Marque a migração como aplicada sem executar:

```bash
npx prisma migrate resolve --applied add_ai_advanced_settings
```

2. Regenere o Prisma Client:

```bash
npx prisma generate
```

### ❌ Erro: "Database connection failed"

**Causa:** PostgreSQL não está rodando

**Solução:**
```bash
# Verificar se o Docker está rodando
docker ps

# Se não estiver, suba novamente
docker-compose up -d
```

### ❌ Erro ao salvar no frontend: "Failed to update"

**Causa:** Backend não está recebendo os campos

**Solução:**
1. Verifique os logs do backend
2. Abra o DevTools (F12) → Network → veja a requisição PUT
3. Confirme que os campos estão sendo enviados:

```json
{
  "companyId": "xxx",
  "provider": "openai",
  "temperature": 0.7,
  "maxTokens": 500,
  "autoReplyEnabled": true
}
```

---

## 📊 SQL da Migração (Referência)

A migração deve criar algo parecido com:

```sql
-- AlterTable
ALTER TABLE "ai_knowledge"
ADD COLUMN "provider" TEXT DEFAULT 'openai',
ADD COLUMN "model" TEXT,
ADD COLUMN "temperature" DOUBLE PRECISION DEFAULT 0.7,
ADD COLUMN "max_tokens" INTEGER DEFAULT 500,
ADD COLUMN "auto_reply_enabled" BOOLEAN DEFAULT true;
```

---

## 🎯 Valores Recomendados

### Para E-commerce / Vendas
```
Provider: openai
Temperature: 0.8 (mais criativo)
Max Tokens: 700 (respostas mais completas)
Auto Reply: true
```

### Para Suporte Técnico
```
Provider: openai
Temperature: 0.3 (mais conservador)
Max Tokens: 500 (respostas concisas)
Auto Reply: true
```

### Para Atendimento Humano + IA
```
Provider: openai
Temperature: 0.5 (balanceado)
Max Tokens: 400 (respostas rápidas)
Auto Reply: false (IA desabilitada, atendente responde)
```

---

## ✨ Pronto!

Após rodar a migração:

✅ Banco de dados atualizado
✅ Backend salvando corretamente
✅ Frontend carregando e salvando
✅ IA usando as configurações personalizadas

**Agora você tem controle total sobre o comportamento da IA! 🚀**
