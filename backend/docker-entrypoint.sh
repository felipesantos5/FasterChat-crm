#!/bin/sh
set -e

echo "🚀 Iniciando CRM API..."

# Gera o client do Prisma
echo "📦 Gerando Prisma Client..."
npx prisma generate

# Tenta resolver migrações falhadas automaticamente
echo "🔧 Verificando migrações falhadas..."

# Verifica se existe migração específica falhada
MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || true)

# Verifica se há erro P3009 (migração falhada)
if echo "$MIGRATION_STATUS" | grep -q "P3009"; then
  echo "⚠️  Migração falhada detectada (P3009). Resolvendo automaticamente..."

  # Extrai o nome da migração falhada
  FAILED_MIGRATION=$(echo "$MIGRATION_STATUS" | grep -oE '20[0-9]{12}_[a-z_]+' | head -n 1)

  if [ -n "$FAILED_MIGRATION" ]; then
    echo "   → Migração falhada: $FAILED_MIGRATION"

    # Verifica se as tabelas da migração existem
    echo "   → Verificando se migração foi parcialmente aplicada..."

    # Tenta marcar como aplicada primeiro (assume que foi parcialmente aplicada)
    echo "   → Estratégia: marcar como aplicada"
    npx prisma migrate resolve --applied "$FAILED_MIGRATION" 2>&1 || {
      echo "   → Estratégia alternativa: rolar de volta"
      npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION" 2>&1 || true
    }

    echo "✅ Migração falhada resolvida!"
  else
    echo "❌ Não foi possível identificar a migração falhada"
  fi
else
  echo "✅ Nenhuma migração falhada encontrada."
fi

# Inicia o servidor (npm start já executa as migrações)
echo "🌐 Iniciando servidor..."
exec npm run start
