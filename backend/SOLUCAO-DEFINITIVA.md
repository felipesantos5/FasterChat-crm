# 🔥 SOLUÇÃO DEFINITIVA - Parar Loop de Restart

## ⚡ Solução Automática (RECOMENDADA)

Execute este comando no PowerShell:

```powershell
cd C:\Users\felip\Documents\github\crm-ai\backend
.\fix-now.ps1
```

Este script vai:
1. ✅ Parar o container que está em loop
2. ✅ Verificar o estado do banco de dados
3. ✅ Corrigir diretamente no banco (sem usar Prisma CLI)
4. ✅ Reiniciar o container
5. ✅ Mostrar os logs para confirmar

---

## 🔧 Solução Manual (Se o script não funcionar)

### Passo 1: Parar o container
```bash
docker-compose stop api
```

### Passo 2: Verificar o estado das tabelas
```bash
docker-compose exec postgres psql -U postgres -d crm
```

Dentro do PostgreSQL, execute:
```sql
-- Verificar tabelas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms');

-- Verificar colunas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'services'
  AND column_name IN ('equipment_type', 'action_type');

-- Verificar estado da migração
SELECT migration_name, finished_at, started_at, logs
FROM "_prisma_migrations"
WHERE migration_name = '20260121000000_add_semantic_service_tables';
```

### Passo 3: Escolher a ação

#### ✅ OPÇÃO A: Se as tabelas EXISTEM (recomendado)

Ainda dentro do PostgreSQL:
```sql
-- Marcar migração como aplicada
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1,
    logs = NULL
WHERE migration_name = '20260121000000_add_semantic_service_tables';

-- Verificar se funcionou
SELECT migration_name, finished_at
FROM "_prisma_migrations"
WHERE migration_name = '20260121000000_add_semantic_service_tables';
```

Sair do PostgreSQL:
```
\q
```

#### ⚠️ OPÇÃO B: Se as tabelas NÃO EXISTEM

Ainda dentro do PostgreSQL:
```sql
-- Remover registro da migração falha
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260121000000_add_semantic_service_tables';
```

Sair do PostgreSQL:
```
\q
```

### Passo 4: Reiniciar o container
```bash
docker-compose up -d api
```

### Passo 5: Verificar logs
```bash
docker-compose logs -f api
```

Você deve ver:
```
✅ Nenhuma migração falhada encontrada.
🚀 Servidor rodando na porta 3051
```

---

## 🚨 Se AINDA não funcionar

### Alternativa 1: Forçar aplicação da migração manualmente

```bash
# 1. Parar API
docker-compose stop api

# 2. Executar migração SQL diretamente
docker-compose exec postgres psql -U postgres -d crm < prisma/migrations/20260121000000_add_semantic_service_tables/migration.sql

# 3. Marcar como aplicada
docker-compose exec postgres psql -U postgres -d crm -c "UPDATE \"_prisma_migrations\" SET finished_at = NOW(), applied_steps_count = 1, logs = NULL WHERE migration_name = '20260121000000_add_semantic_service_tables';"

# 4. Reiniciar
docker-compose up -d api
```

### Alternativa 2: Resetar banco (⚠️ APAGA TODOS OS DADOS)

```bash
# ⚠️ ISSO VAI APAGAR TUDO!
docker-compose down
docker volume rm backend_postgres_data
docker-compose up -d
```

---

## 📊 Verificação Final

Após aplicar a solução, execute:

```bash
# Ver logs em tempo real
docker-compose logs -f api

# Verificar status das migrações
docker-compose exec api npx prisma migrate status

# Verificar se a API está respondendo
curl http://localhost:3051/health
```

Se tudo estiver OK, você deve ver:
```
✅ Nenhuma migração falhada encontrada.
🚀 Servidor rodando na porta 3051
Database schema is up to date!
```

---

## 🔍 Por que isso aconteceu?

O problema ocorreu porque:
1. A migração `20260121000000_add_semantic_service_tables` falhou durante a execução
2. O Prisma marcou ela como "failed" no banco
3. O entrypoint do Docker executa `prisma migrate deploy` no startup
4. O Prisma vê a migração falha e recusa aplicar novas migrações
5. O container falha e reinicia infinitamente

## ✅ Como evitar no futuro

1. **Sempre teste migrações localmente antes de aplicar em produção**
2. **Use `prisma migrate dev` em desenvolvimento**
3. **Em produção, use `prisma migrate deploy` apenas após testar**
4. **Faça backup do banco antes de migrações complexas**

---

## 📞 Ajuda Adicional

Se nada funcionar, me avise e eu crio uma solução mais agressiva que:
- Recria completamente a migração
- Faz backup dos dados
- Reseta o estado das migrações
