# 🐳 Guia de Reset do Docker - CRM AI

## ❌ Erro Comum: P3009 - Migração Falhada

### Sintoma
```
Error: P3009
migrate found failed migrations in the target database
The `20260121000000_add_semantic_service_tables` migration failed
```

### Causa Raiz
A migração tinha dois erros:
1. Usava `gen_random_uuid()` sem habilitar a extensão `pgcrypto`
2. INSERT com 6 colunas declaradas mas apenas 5 valores fornecidos (faltava `is_active`)

✅ **JÁ CORRIGIDO**:
1. Extensão `pgcrypto` adicionada
2. Valor `true` adicionado para coluna `is_active` em cada INSERT

---

## 🔄 Como Resetar o Ambiente Corretamente

### Opção 1: Reset + Rebuild Sem Cache (MAIS SEGURO)

⚠️ **IMPORTANTE**: Sempre use `--no-cache` ao rebuildar após corrigir migrações!

```bash
cd backend
docker-compose down -v
docker-compose build --no-cache api
docker-compose up -d
```

### Opção 2: Script Automático (Básico)

**Windows:**
```bash
cd backend
reset-docker.bat
```

**Linux/Mac:**
```bash
cd backend
chmod +x reset-docker.sh
./reset-docker.sh
```

⚠️ **Nota**: Os scripts não usam `--no-cache`. Se persistir erro, use a Opção 1.

### Opção 2: Manual Passo a Passo

```bash
cd backend

# 1. Para e remove tudo
docker-compose down -v

# 2. Limpa volumes órfãos
docker volume prune -f

# 3. Remove volumes específicos (se necessário)
docker volume rm backend_postgres_data
docker volume rm backend_postgres_evo_data
docker volume rm backend_redis_data
docker volume rm backend_evolution_instancesv2

# 4. Verifica se removeu
docker volume ls | grep -E "postgres|redis|evolution"

# 5. Reconstrói e sobe
docker-compose up -d --build

# 6. Acompanha os logs
docker-compose logs -f api
```

---

## 🐛 Se a Migração Ainda Falhar

### Solução 1: Corrigir Manualmente no Banco

```bash
# Acesse o container
docker exec -it crm_postgres psql -U postgres -d crm

# Habilite as extensões
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

# Marque a migração como resolvida
UPDATE "_prisma_migrations"
SET finished_at = NOW(), success = true, logs = 'Manually resolved - extensions enabled'
WHERE migration_name = '20260121000000_add_semantic_service_tables';

# Saia
\q

# Aplique novamente
docker exec -it crm_backend npx prisma migrate deploy
```

### Solução 2: Reset Completo do Prisma

```bash
# ATENÇÃO: Apaga todos os dados!
docker exec -it crm_backend npx prisma migrate reset --force
```

---

## 🛡️ Prevenção

### ✅ Checklist Antes de Criar Migrações

1. **Extensões PostgreSQL**: Sempre habilite extensões necessárias no início:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Funções Usadas**:
   - `gen_random_uuid()` → requer `pgcrypto`
   - `uuid_generate_v4()` → requer `uuid-ossp`
   - `vector(1536)` → requer `vector`/`pgvector`

3. **Testar Migração Antes de Commit**:
   ```bash
   # Reset local
   npm run prisma:migrate:reset

   # Aplica e testa
   npm run prisma:migrate:dev
   ```

---

## 📝 Comandos Úteis

```bash
# Ver logs da API
docker-compose logs -f api

# Ver logs do Postgres
docker-compose logs -f postgres

# Entrar no container da API
docker exec -it crm_backend sh

# Entrar no Postgres
docker exec -it crm_postgres psql -U postgres -d crm

# Ver volumes
docker volume ls

# Ver migrações no banco
docker exec -it crm_postgres psql -U postgres -d crm -c "SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;"

# Verificar extensões habilitadas
docker exec -it crm_postgres psql -U postgres -d crm -c "SELECT * FROM pg_extension;"
```

---

## 🆘 Troubleshooting

### "docker-compose down -v não remove os volumes"

**Possíveis causas:**
1. Volumes não são gerenciados pelo docker-compose (criados manualmente)
2. Outros containers estão usando os volumes
3. Permissões de arquivo (Linux/Mac)

**Solução:**
```bash
# Para TODOS os containers
docker stop $(docker ps -aq)

# Remove TODOS os volumes não utilizados
docker volume prune -a -f

# Remove volume específico à força
docker volume rm -f backend_postgres_data
```

### "Migração falha mesmo após reset"

1. Verifique se a imagem tem pgvector:
   ```bash
   docker exec -it crm_postgres psql -U postgres -c "SELECT * FROM pg_available_extensions WHERE name IN ('vector', 'pgcrypto');"
   ```

2. Se não tiver, o docker-compose.yml está correto?
   - Imagem: `pgvector/pgvector:pg16` ✅
   - Imagem: `postgres:16-alpine` ❌ (não tem pgvector)

### "Dados importantes no banco - não posso resetar"

Use a Solução 1 (Corrigir Manualmente no Banco) acima.

---

## 📚 Referências

- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [PostgreSQL Extensions](https://www.postgresql.org/docs/current/contrib.html)
