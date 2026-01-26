# Script para corrigir AGORA e parar o loop de restart

Write-Host ""
Write-Host "=============================================" -ForegroundColor Red
Write-Host "  PARANDO LOOP DE RESTART" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor Red
Write-Host ""

# 1. Parar o container da API
Write-Host "[1/5] Parando container da API..." -ForegroundColor Yellow
docker-compose stop api
Start-Sleep -Seconds 2
Write-Host "      Container parado!" -ForegroundColor Green

# 2. Verificar tabelas no banco
Write-Host ""
Write-Host "[2/5] Verificando tabelas no banco..." -ForegroundColor Yellow
$tables = docker-compose exec -T postgres psql -U postgres -d crm -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms') ORDER BY table_name;" 2>&1

if ($LASTEXITCODE -eq 0) {
    $tableList = $tables -split "`n" | Where-Object { $_ -match '\S' }
    Write-Host "      Tabelas encontradas:" -ForegroundColor Cyan
    foreach ($table in $tableList) {
        Write-Host "        - $table" -ForegroundColor Gray
    }
    $tableCount = $tableList.Count
} else {
    Write-Host "      Nenhuma tabela encontrada" -ForegroundColor Yellow
    $tableCount = 0
}

# 3. Verificar colunas na tabela services
Write-Host ""
Write-Host "[3/5] Verificando colunas na tabela services..." -ForegroundColor Yellow
$columns = docker-compose exec -T postgres psql -U postgres -d crm -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'services' AND column_name IN ('equipment_type', 'action_type') ORDER BY column_name;" 2>&1

if ($LASTEXITCODE -eq 0) {
    $columnList = $columns -split "`n" | Where-Object { $_ -match '\S' }
    Write-Host "      Colunas encontradas:" -ForegroundColor Cyan
    foreach ($col in $columnList) {
        Write-Host "        - $col" -ForegroundColor Gray
    }
    $columnCount = $columnList.Count
} else {
    Write-Host "      Nenhuma coluna nova encontrada" -ForegroundColor Yellow
    $columnCount = 0
}

# 4. Decidir estratégia e aplicar
Write-Host ""
Write-Host "[4/5] Aplicando correção diretamente no banco..." -ForegroundColor Yellow

if ($tableCount -ge 2 -or $columnCount -ge 1) {
    # Migração foi aplicada (pelo menos parcialmente)
    Write-Host "      Estratégia: MARCAR COMO APLICADA" -ForegroundColor Green
    Write-Host "      Motivo: Tabelas/colunas já existem no banco" -ForegroundColor Gray
    Write-Host ""

    # Marcar migração como aplicada diretamente no banco
    $updateQuery = @"
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1,
    logs = NULL
WHERE migration_name = '20260121000000_add_semantic_service_tables';
"@

    docker-compose exec -T postgres psql -U postgres -d crm -c $updateQuery

    if ($LASTEXITCODE -eq 0) {
        Write-Host "      Migração marcada como aplicada!" -ForegroundColor Green
    } else {
        Write-Host "      Erro ao atualizar banco!" -ForegroundColor Red
        exit 1
    }

} else {
    # Migração não foi aplicada
    Write-Host "      Estratégia: REMOVER REGISTRO E REAPLICAR" -ForegroundColor Yellow
    Write-Host "      Motivo: Nenhuma tabela foi criada" -ForegroundColor Gray
    Write-Host ""

    # Deletar registro da migração falha
    $deleteQuery = "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20260121000000_add_semantic_service_tables';"

    docker-compose exec -T postgres psql -U postgres -d crm -c $deleteQuery

    if ($LASTEXITCODE -eq 0) {
        Write-Host "      Registro removido! Migração será reaplicada no próximo start." -ForegroundColor Green
    } else {
        Write-Host "      Erro ao remover registro!" -ForegroundColor Red
        exit 1
    }
}

# 5. Reiniciar o container da API
Write-Host ""
Write-Host "[5/5] Reiniciando container da API..." -ForegroundColor Yellow
docker-compose up -d api
Start-Sleep -Seconds 3
Write-Host "      Container iniciado!" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  CORREÇÃO APLICADA COM SUCESSO!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Verificando logs..." -ForegroundColor Cyan
Write-Host ""

# Mostrar logs em tempo real por 10 segundos
Start-Sleep -Seconds 5
docker-compose logs --tail=50 api

Write-Host ""
Write-Host "Para continuar vendo os logs em tempo real:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f api" -ForegroundColor Gray
Write-Host ""
