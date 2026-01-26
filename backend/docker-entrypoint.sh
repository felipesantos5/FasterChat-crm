#!/bin/sh
set -e

echo "🚀 Iniciando CRM API..."

# Gera o client do Prisma
echo "📦 Gerando Prisma Client..."
npx prisma generate

# Tenta resolver migrações falhadas automaticamente
echo "🔧 Verificando migrações falhadas..."

# Lista todas as migrações falhadas
FAILED_MIGRATIONS=$(npx prisma migrate status 2>&1 | grep -E "migration.*failed" | grep -o '[0-9]\{14\}_[a-z_]*' || true)

if [ -n "$FAILED_MIGRATIONS" ]; then
  echo "⚠️  Migrações falhadas detectadas. Resolvendo automaticamente..."
  
  # Resolve cada migração falhada
  echo "$FAILED_MIGRATIONS" | while read -r migration; do
    if [ -n "$migration" ]; then
      echo "   → Resolvendo: $migration"
      npx prisma migrate resolve --rolled-back "$migration" || true
    fi
  done
  
  echo "✅ Migrações falhadas resolvidas!"
else
  echo "✅ Nenhuma migração falhada encontrada."
fi

# Inicia o servidor (npm start já executa as migrações)
echo "🌐 Iniciando servidor..."
exec npm run start
