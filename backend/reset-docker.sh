#!/bin/bash

# Script para resetar completamente o ambiente Docker
# USO: ./reset-docker.sh

set -e

echo "🔄 Parando containers..."
docker-compose down -v

echo "🧹 Limpando volumes órfãos..."
docker volume prune -f

echo "🗑️  Removendo volumes específicos (se existirem)..."
docker volume rm backend_postgres_data 2>/dev/null || true
docker volume rm backend_postgres_evo_data 2>/dev/null || true
docker volume rm backend_redis_data 2>/dev/null || true
docker volume rm backend_evolution_instancesv2 2>/dev/null || true

echo "📦 Verificando volumes restantes..."
docker volume ls | grep -E "(postgres|redis|evolution)" || echo "✅ Nenhum volume relacionado encontrado"

echo "🏗️  Reconstruindo e subindo containers..."
docker-compose up -d --build

echo "⏳ Aguardando inicialização dos serviços..."
sleep 10

echo "🔍 Verificando status dos containers..."
docker-compose ps

echo ""
echo "✅ Reset completo! Verifique os logs:"
echo "   docker-compose logs -f api"
