#!/bin/sh
set -e

echo "🚀 Iniciando CRM API..."

# Gera o client do Prisma
echo "📦 Gerando Prisma Client..."
npx prisma generate

# Tenta resolver migrações falhadas automaticamente
echo "🔧 Verificando migrações falhadas..."
FAILED_MIGRATIONS=$(npx prisma migrate status 2>&1 | grep -o '[0-9]\{14\}_[a-z_]*' | head -5 || true)

if echo "$FAILED_MIGRATIONS" | grep -q "20260119000000_add_knowledge_vectors_rag"; then
  echo "⚠️  Migração RAG falhada detectada. Resolvendo automaticamente..."
  npx prisma migrate resolve --rolled-back 20260119000000_add_knowledge_vectors_rag || true
fi

# Aplica as migrações pendentes
echo "🗃️  Aplicando migrações..."
npx prisma migrate deploy

echo "✅ Migrações aplicadas com sucesso!"

# Inicia o servidor
echo "🌐 Iniciando servidor..."
exec npm run start
