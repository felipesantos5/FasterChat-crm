# 🐋 Evolution API no Docker - Guia Completo

## 📌 Respondendo sua pergunta: Sim, o Evolution API roda em container Docker!

O Evolution API **já está configurado** no seu `docker-compose.yml` e vai subir automaticamente quando você rodar:

```bash
docker-compose up -d
```

---

## 🏗️ Arquitetura do Docker Compose

O seu `docker-compose.yml` configura **4 containers**:

### 1. 🐘 PostgreSQL (CRM)
```yaml
crm_postgres
├─ Porta: 5432
├─ Database: crm_db
├─ Usuário: crm_user
└─ Senha: crm_password
```
**Para que serve:** Banco de dados do seu CRM (clientes, conversas, mensagens)

### 2. 🐘 PostgreSQL (Evolution API)
```yaml
evolution_postgres
├─ Database: evolution_db
├─ Usuário: evolution_user
└─ Senha: evolution_password
```
**Para que serve:** Banco de dados exclusivo para o Evolution API (instâncias, sessões do WhatsApp)

### 3. 🔴 Redis
```yaml
crm_redis
├─ Porta: 6379
└─ Persistência: Sim (appendonly)
```
**Para que serve:** Cache e fila de mensagens para melhorar performance

### 4. 📱 Evolution API
```yaml
evolution_api
├─ Porta: 8088 → 8080 (container)
├─ Imagem: atendai/evolution-api:latest
├─ API Key: crm-api-key-secure-2024
└─ Conecta em: evolution_postgres + redis
```
**Para que serve:** Gateway do WhatsApp (recebe/envia mensagens)

---

## ⚙️ Como o Evolution API está configurado

### Variáveis de Ambiente Principais

```yaml
# Versão do WhatsApp Web
CONFIG_SESSION_PHONE_VERSION: 2.3000.1029362725

# Banco de Dados
DATABASE_ENABLED: true
DATABASE_PROVIDER: postgresql
DATABASE_CONNECTION_URI: postgresql://evolution_user:evolution_password@postgresql-evo:5432/evolution_db

# Redis (Cache)
REDIS_ENABLED: true
REDIS_URI: redis://redis:6379

# Autenticação
AUTHENTICATION_TYPE: apikey
AUTHENTICATION_API_KEY: crm-api-key-secure-2024

# Servidor
SERVER_TYPE: http
SERVER_PORT: 8080
SERVER_URL: http://localhost:8088
```

---

## 🚀 Passo a Passo para Rodar

### 1. Criar Volume (Primeira vez APENAS)

```bash
docker volume create evolution_instancesv2
```

**Por que?** O Evolution API salva as sessões do WhatsApp neste volume. Se você não criar, ele perde a sessão quando o container reiniciar.

### 2. Subir os Containers

```bash
docker-compose up -d
```

Isso vai:
1. Baixar as imagens (primeira vez)
2. Criar os containers
3. Iniciar todos os serviços

### 3. Verificar se Subiu

```bash
docker-compose ps
```

Você deve ver:
```
NAME                STATUS              PORTS
crm_postgres        Up                  0.0.0.0:5432->5432/tcp
evolution_postgres  Up                  (não exposta)
crm_redis          Up                  0.0.0.0:6379->6379/tcp
evolution_api      Up                  0.0.0.0:8088->8080/tcp
```

### 4. Ver Logs do Evolution API

```bash
docker logs evolution_api -f
```

Aguarde ver:
```
✓ Database connected
✓ Redis connected
✓ Server started on port 8080
```

---

## 🧪 Testar se o Evolution API está Funcionando

### 1. Teste Básico (Health Check)

```bash
curl http://localhost:8088
```

Deve retornar algo como:
```json
{
  "status": "ok",
  "version": "2.x.x"
}
```

### 2. Criar uma Instância de Teste (via API)

```bash
curl -X POST http://localhost:8088/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: crm-api-key-secure-2024" \
  -d '{
    "instanceName": "teste_manual",
    "qrcode": true
  }'
```

Vai retornar:
```json
{
  "instance": {
    "instanceName": "teste_manual",
    "status": "created"
  },
  "hash": {
    "apikey": "..."
  },
  "qrcode": {
    "base64": "data:image/png;base64,..."
  }
}
```

### 3. Ver o QR Code

Pegue o `base64` do retorno e cole no navegador ou salve como imagem.

---

## 🔗 Como seu CRM se Conecta ao Evolution API

### Fluxo de Comunicação:

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Backend   │─────▶│ Evolution API│─────▶│  WhatsApp   │
│  (Node.js)  │      │   (Docker)   │      │   Servers   │
└─────────────┘      └──────────────┘      └─────────────┘
       ▲                     │
       │                     │
       └─────────────────────┘
          Webhook (mensagens)
```

### 1. Backend → Evolution API (Enviar Mensagem)

```typescript
// backend/src/services/whatsapp.service.ts
axios.post(`http://localhost:8088/message/sendText/${instanceName}`, {
  number: "5511999999999@s.whatsapp.net",
  text: "Olá do CRM!"
}, {
  headers: {
    'apikey': 'crm-api-key-secure-2024'
  }
});
```

### 2. Evolution API → Backend (Receber Mensagem)

O Evolution API envia webhook quando chega mensagem:

```bash
POST http://host.docker.internal:3001/api/webhooks/whatsapp
Headers:
  X-Webhook-Secret: your-webhook-secret-key
  Content-Type: application/json

Body:
{
  "event": "messages.upsert",
  "instance": "instance_name",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "id": "message-id"
    },
    "message": {
      "conversation": "Olá!"
    }
  }
}
```

---

## 🔧 Comandos Úteis do Docker

### Ver logs em tempo real
```bash
docker logs evolution_api -f
```

### Reiniciar o Evolution API
```bash
docker restart evolution_api
```

### Parar todos os containers
```bash
docker-compose down
```

### Parar e REMOVER volumes (cuidado!)
```bash
docker-compose down -v
```

### Entrar no container (debug)
```bash
docker exec -it evolution_api sh
```

### Ver uso de recursos
```bash
docker stats
```

---

## 📂 Onde Ficam os Dados?

### Volumes Docker:

```
evolution_instancesv2/
├─ instances/
│  ├─ instance_xxx/
│  │  ├─ store/          # Sessão do WhatsApp
│  │  └─ media/          # Mídias enviadas/recebidas
│  └─ instance_yyy/
└─ ...
```

Para ver onde está no seu PC:

```bash
docker volume inspect evolution_instancesv2
```

### Banco de Dados:

Todas as mensagens, contatos e configurações ficam no PostgreSQL:

```bash
# Entrar no banco do Evolution
docker exec -it evolution_postgres psql -U evolution_user -d evolution_db

# Ver tabelas
\dt

# Ver instâncias
SELECT * FROM instances;
```

---

## ⚠️ Problemas Comuns

### ❌ Erro: "volume evolution_instancesv2 not found"

**Solução:**
```bash
docker volume create evolution_instancesv2
docker-compose up -d
```

### ❌ Evolution API não sobe

**Verificar logs:**
```bash
docker logs evolution_api --tail 50
```

**Causa comum:** PostgreSQL não está pronto ainda

**Solução:** Aguardar 30 segundos e tentar novamente:
```bash
docker restart evolution_api
```

### ❌ "Cannot connect to database"

**Verificar se o PostgreSQL está rodando:**
```bash
docker logs evolution_postgres
```

**Solução:**
```bash
docker-compose down
docker-compose up -d
```

### ❌ QR Code não aparece

**1. Verificar se o webhook está configurado:**
```bash
docker logs evolution_api | grep webhook
```

**2. Recriar a instância:**
- Delete no dashboard
- Crie novamente

### ❌ Webhook não recebe mensagens

**Verificar URL do webhook:**

No `.env`:
```bash
WEBHOOK_URL=http://host.docker.internal:3001
```

**Importante:** Use `host.docker.internal` e não `localhost` quando o backend roda FORA do Docker!

Se o backend também estivesse em Docker:
```bash
WEBHOOK_URL=http://backend:3001
```

---

## 🔒 Segurança

### Alterar API Key (Recomendado para Produção)

**1. No `.env`:**
```bash
EVOLUTION_API_KEY=sua-chave-super-secreta-aqui
```

**2. No `docker-compose.yml`:**
```yaml
environment:
  - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
```

**3. Reiniciar:**
```bash
docker-compose down
docker-compose up -d
```

### Webhook Secret

Sempre use o header `X-Webhook-Secret` para validar que o webhook veio realmente do Evolution API.

---

## 📊 Monitoramento

### Ver Status das Instâncias

```bash
curl http://localhost:8088/instance/fetchInstances \
  -H "apikey: crm-api-key-secure-2024"
```

### Ver Uso de Memória/CPU

```bash
docker stats evolution_api
```

### Healthcheck Automático

O Docker verifica se o Evolution está saudável automaticamente. Se falhar, reinicia.

---

## 🚀 Produção

### Usar Docker Compose em Produção

**Adicionar restart policy:**
```yaml
evolution-api:
  restart: always
```

**Limitar recursos:**
```yaml
evolution-api:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

**Usar arquivo .env separado:**
```bash
docker-compose --env-file .env.production up -d
```

---

## 🎉 Resumo

✅ **Evolution API roda em Docker? SIM!**

✅ **Já está configurado? SIM!**

✅ **Preciso fazer algo especial? NÃO, apenas:**

```bash
# 1. Criar volume (primeira vez)
docker volume create evolution_instancesv2

# 2. Subir tudo
docker-compose up -d

# 3. Aguardar 30 segundos

# 4. Verificar logs
docker logs evolution_api -f

# 5. Usar no CRM normalmente!
```

**Pronto! O Evolution API está rodando e pronto para conectar WhatsApp! 🎊**

---

## 📞 Endpoints Principais do Evolution API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/instance/create` | Criar instância |
| GET | `/instance/qrcode/:name` | Obter QR Code |
| GET | `/instance/connectionState/:name` | Status da conexão |
| DELETE | `/instance/delete/:name` | Deletar instância |
| POST | `/message/sendText/:name` | Enviar mensagem de texto |
| POST | `/webhook/set/:name` | Configurar webhook |

**Documentação completa:** https://doc.evolution-api.com

---

**Tudo rodando em Docker, tudo automatizado! 🐋✨**
