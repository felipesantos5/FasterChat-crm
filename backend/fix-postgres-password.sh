#!/bin/bash

# Script para resetar a senha do PostgreSQL em produção
# Execute este script no terminal do Coolify

echo "🔧 Iniciando reset da senha do PostgreSQL..."

# 1. Para o container do backend para evitar conexões
echo "📦 Parando o container do backend..."
docker stop crm_backend || true

# 2. Acessa o container do PostgreSQL e reseta a senha
echo "🔑 Resetando a senha do usuário postgres..."
docker exec -it crm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'admin123';"

# Se o comando acima falhar, tente este método alternativo:
if [ $? -ne 0 ]; then
    echo "⚠️  Método 1 falhou. Tentando método alternativo..."
    
    # Para o PostgreSQL temporariamente
    docker stop crm_postgres
    
    # Inicia o PostgreSQL em modo de confiança (sem senha)
    docker run --rm \
        --name temp_postgres_fix \
        -v postgres_data:/var/lib/postgresql/data \
        -e POSTGRES_HOST_AUTH_METHOD=trust \
        -d pgvector/pgvector:pg16
    
    # Aguarda o PostgreSQL iniciar
    sleep 10
    
    # Reseta a senha
    docker exec -it temp_postgres_fix psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'admin123';"
    
    # Para o container temporário
    docker stop temp_postgres_fix
    
    # Reinicia o PostgreSQL normal
    docker start crm_postgres
fi

# 3. Aguarda o PostgreSQL estar pronto
echo "⏳ Aguardando PostgreSQL inicializar..."
sleep 10

# 4. Reinicia o backend
echo "🚀 Reiniciando o backend..."
docker start crm_backend

echo "✅ Processo concluído! Verifique os logs:"
echo "   docker logs crm_postgres"
echo "   docker logs crm_backend"
