# Script PowerShell para resolver a migração falha do Prisma
# Execute este script após iniciar o Docker Desktop

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Fixing Prisma Migration" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Docker está rodando
Write-Host "Verificando se Docker está rodando..." -ForegroundColor Yellow
$dockerRunning = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Docker não está rodando!" -ForegroundColor Red
    Write-Host "Por favor, inicie o Docker Desktop e tente novamente." -ForegroundColor Yellow
    exit 1
}

# 1. Verificar se as tabelas existem
Write-Host ""
Write-Host "1. Verificando se as tabelas foram criadas..." -ForegroundColor Yellow
docker-compose exec -T postgres psql -U postgres -d crm -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms');"

# 2. Verificar estado da migração
Write-Host ""
Write-Host "2. Verificando estado da migração..." -ForegroundColor Yellow
docker-compose exec -T postgres psql -U postgres -d crm -c "SELECT migration_name, finished_at, started_at FROM \"_prisma_migrations\" WHERE migration_name = '20260121000000_add_semantic_service_tables';"

# 3. Perguntar ao usuário qual ação tomar
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Escolha uma opção:" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "[A] Se as tabelas EXISTEM - marcar migração como aplicada" -ForegroundColor Green
Write-Host "[B] Se as tabelas NÃO EXISTEM - rolar de volta e reaplicar" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "Digite A ou B"

if ($choice -eq "A" -or $choice -eq "a") {
    Write-Host ""
    Write-Host "Marcando migração como aplicada..." -ForegroundColor Green
    npx prisma migrate resolve --applied 20260121000000_add_semantic_service_tables

    Write-Host ""
    Write-Host "Verificando status das migrações..." -ForegroundColor Yellow
    npx prisma migrate status

} elseif ($choice -eq "B" -or $choice -eq "b") {
    Write-Host ""
    Write-Host "Marcando migração como revertida..." -ForegroundColor Yellow
    npx prisma migrate resolve --rolled-back 20260121000000_add_semantic_service_tables

    Write-Host ""
    Write-Host "Aplicando migrações novamente..." -ForegroundColor Yellow
    npx prisma migrate deploy

} else {
    Write-Host "Opção inválida!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Processo concluído!" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
