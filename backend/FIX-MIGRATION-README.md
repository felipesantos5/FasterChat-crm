# Como Corrigir a Migração Falha do Prisma

## Problema
A migração `20260121000000_add_semantic_service_tables` falhou e está impedindo novas migrações de serem aplicadas.

## Solução Rápida (Recomendada)

### 1. Inicie o Docker Desktop
Certifique-se de que o Docker Desktop está rodando no Windows.

### 2. Execute o script de correção

**No PowerShell (Windows):**
```powershell
cd C:\Users\felip\Documents\github\crm-ai\backend
.\fix-migration.ps1
```

**No Git Bash (Linux/Mac):**
```bash
cd /c/Users/felip/Documents/github/crm-ai/backend
bash fix-migration.sh
```

### 3. Siga as instruções do script
O script vai verificar o estado do banco e te dar duas opções:
- **Opção A**: Se as tabelas já existem → marca a migração como aplicada
- **Opção B**: Se as tabelas não existem → reverte e reaplica a migração

---

## Solução Manual

### 1. Verificar o estado das tabelas

```bash
cd backend
docker-compose exec postgres psql -U postgres -d crm
```

Dentro do PostgreSQL, execute:

```sql
-- Verificar se as tabelas existem
\dt service_vectors
\dt service_relationships
\dt domain_synonyms

-- Verificar colunas na tabela services
\d services

-- Verificar estado da migração
SELECT migration_name, finished_at, started_at
FROM "_prisma_migrations"
WHERE migration_name = '20260121000000_add_semantic_service_tables';
```

### 2. Escolher a ação apropriada

#### Se as tabelas EXISTEM (migração aplicada parcialmente):

```bash
# Saia do psql (Ctrl+D ou \q)
npx prisma migrate resolve --applied 20260121000000_add_semantic_service_tables
npx prisma migrate status
```

#### Se as tabelas NÃO EXISTEM (migração falhou completamente):

```bash
# Saia do psql (Ctrl+D ou \q)
npx prisma migrate resolve --rolled-back 20260121000000_add_semantic_service_tables
npx prisma migrate deploy
```

### 3. Verificar se está tudo OK

```bash
npx prisma migrate status
```

Deve mostrar todas as migrações como aplicadas com sucesso.

---

## Alternativa: Resolver pelo Docker

Se você preferir fazer tudo manualmente pelo Docker:

```bash
cd backend

# 1. Verificar tabelas
docker-compose exec postgres psql -U postgres -d crm -c "\dt service_*"

# 2. Verificar migração
docker-compose exec postgres psql -U postgres -d crm -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20260121000000_add_semantic_service_tables';"

# 3a. Se tabelas existem:
npx prisma migrate resolve --applied 20260121000000_add_semantic_service_tables

# 3b. Se tabelas NÃO existem:
npx prisma migrate resolve --rolled-back 20260121000000_add_semantic_service_tables
npx prisma migrate deploy
```

---

## O que a migração faz?

Esta migração adiciona:
- ✅ Tabela `service_vectors` (para busca semântica de serviços)
- ✅ Tabela `service_relationships` (para relacionamentos entre serviços)
- ✅ Tabela `domain_synonyms` (para dicionário de sinônimos)
- ✅ Colunas `equipment_type` e `action_type` na tabela `services`
- ✅ Extensão `pgvector` (para vetores de embeddings)

---

## Possíveis causas do erro

1. ❌ Extensão `pgvector` não disponível (mas a imagem `pgvector/pgvector:pg16` já inclui)
2. ❌ Permissões insuficientes no banco
3. ❌ Banco interrompido durante a migração
4. ❌ Índice HNSW falhou ao ser criado

---

## Se nada funcionar

Como último recurso, você pode resetar as migrações (⚠️ CUIDADO: isso apaga todos os dados):

```bash
# ⚠️ ISSO VAI APAGAR TUDO NO BANCO!
docker-compose down -v
docker-compose up -d postgres redis
npx prisma migrate deploy
```

---

## Verificação Final

Após resolver, execute:

```bash
npx prisma migrate status
npx prisma generate
npm run dev  # ou docker-compose restart api
```

Se tudo estiver OK, você deve ver:
```
Database schema is up to date!
✅ All migrations applied successfully
```
