#!/bin/bash

# Script para resolver a migração falha do Prisma
# Execute este script após iniciar o Docker

echo "==================================="
echo "Fixing Prisma Migration"
echo "==================================="

# 1. Verificar se as tabelas existem
echo ""
echo "1. Verificando se as tabelas foram criadas..."
docker-compose exec -T postgres psql -U postgres -d crm -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms');
"

# 2. Verificar estado da migração
echo ""
echo "2. Verificando estado da migração..."
docker-compose exec -T postgres psql -U postgres -d crm -c "
SELECT migration_name, finished_at, started_at, applied_steps_count
FROM \"_prisma_migrations\"
WHERE migration_name = '20260121000000_add_semantic_service_tables';
"

# 3. Opções de resolução
echo ""
echo "==================================="
echo "Escolha uma opção:"
echo "==================================="
echo "A) Se as tabelas EXISTEM - marcar migração como aplicada"
echo "B) Se as tabelas NÃO EXISTEM - rolar de volta e reaplicar"
echo ""
read -p "Digite A ou B: " choice

if [ "$choice" = "A" ] || [ "$choice" = "a" ]; then
    echo ""
    echo "Marcando migração como aplicada..."
    npx prisma migrate resolve --applied 20260121000000_add_semantic_service_tables
    echo ""
    echo "Verificando status das migrações..."
    npx prisma migrate status

elif [ "$choice" = "B" ] || [ "$choice" = "b" ]; then
    echo ""
    echo "Marcando migração como revertida..."
    npx prisma migrate resolve --rolled-back 20260121000000_add_semantic_service_tables
    echo ""
    echo "Aplicando migrações novamente..."
    npx prisma migrate deploy

else
    echo "Opção inválida!"
    exit 1
fi

echo ""
echo "==================================="
echo "Processo concluído!"
echo "==================================="
