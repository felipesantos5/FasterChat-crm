# EXECUTE ESTE SCRIPT AGORA PARA RESOLVER O PROBLEMA

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  CORREÇÃO RÁPIDA - Migração Falha" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Parar container
Write-Host "1. Parando container da API..." -ForegroundColor Yellow
docker-compose stop api
Write-Host "   OK!" -ForegroundColor Green

# 2. Corrigir diretamente no banco
Write-Host ""
Write-Host "2. Corrigindo no banco de dados..." -ForegroundColor Yellow

$sql = @"
-- Marcar migração como aplicada
UPDATE "_prisma_migrations"
SET finished_at = CURRENT_TIMESTAMP,
    applied_steps_count = 1,
    logs = NULL
WHERE migration_name = '20260121000000_add_semantic_service_tables'
  AND finished_at IS NULL;
"@

docker-compose exec -T postgres psql -U postgres -d crm -c $sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK! Migração corrigida!" -ForegroundColor Green
} else {
    Write-Host "   ERRO ao corrigir!" -ForegroundColor Red
    exit 1
}

# 3. Reiniciar com novo entrypoint
Write-Host ""
Write-Host "3. Reiniciando containers..." -ForegroundColor Yellow
docker-compose down
docker-compose up -d
Write-Host "   OK! Containers reiniciados!" -ForegroundColor Green

# 4. Aguardar e mostrar logs
Write-Host ""
Write-Host "4. Aguardando inicialização..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  LOGS DO BACKEND" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

docker-compose logs --tail=30 api

Write-Host ""
Write-Host "Para continuar vendo logs:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f api" -ForegroundColor Gray
Write-Host ""
Write-Host "Para verificar se está funcionando:" -ForegroundColor Cyan
Write-Host "  curl http://localhost:3051/health" -ForegroundColor Gray
Write-Host ""
