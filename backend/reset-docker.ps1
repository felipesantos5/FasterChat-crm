# Script para resetar completamente o ambiente Docker no Windows (PowerShell)
# USO: .\reset-docker.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  RESET DOCKER - CRM AI  " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Parando containers..." -ForegroundColor Yellow
docker-compose down -v

Write-Host ""
Write-Host "Limpando volumes orfaos..." -ForegroundColor Yellow
docker volume prune -f

Write-Host ""
Write-Host "Removendo volumes especificos..." -ForegroundColor Yellow
docker volume rm backend_postgres_data 2>$null
docker volume rm backend_postgres_evo_data 2>$null
docker volume rm backend_redis_data 2>$null
docker volume rm backend_evolution_instancesv2 2>$null

Write-Host ""
Write-Host "Verificando volumes restantes..." -ForegroundColor Yellow
$volumes = docker volume ls | Select-String -Pattern "postgres|redis|evolution"
if ($volumes) {
    Write-Host $volumes
} else {
    Write-Host "Nenhum volume relacionado encontrado" -ForegroundColor Green
}

Write-Host ""
Write-Host "Reconstruindo e subindo containers..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host ""
Write-Host "Aguardando inicializacao (10s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "Verificando status dos containers..." -ForegroundColor Yellow
docker-compose ps

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  RESET COMPLETO!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para ver os logs: docker-compose logs -f api" -ForegroundColor White
Write-Host ""
