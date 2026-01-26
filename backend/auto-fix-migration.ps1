# Script Automático para Resolver Migração Falha do Prisma
# Este script detecta automaticamente a melhor solução

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  AUTO FIX - Prisma Migration" -ForegroundColor Cyan
Write-Host "  20260121000000_add_semantic_service_tables" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Docker está rodando
Write-Host "[1/4] Verificando Docker..." -ForegroundColor Yellow
$dockerCheck = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERRO: Docker não está rodando!" -ForegroundColor Red
    Write-Host "Solução: Inicie o Docker Desktop e execute este script novamente." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
Write-Host "      Docker está rodando!" -ForegroundColor Green

# Verificar se as tabelas existem
Write-Host ""
Write-Host "[2/4] Verificando estado das tabelas no banco..." -ForegroundColor Yellow

$tablesCheck = docker-compose exec -T postgres psql -U postgres -d crm -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms');" 2>&1

if ($LASTEXITCODE -eq 0) {
    $tableCount = [int]$tablesCheck.Trim()
    Write-Host "      Tabelas encontradas: $tableCount/3" -ForegroundColor Cyan
} else {
    Write-Host "      Erro ao verificar tabelas" -ForegroundColor Red
    $tableCount = 0
}

# Verificar estado da migração
Write-Host ""
Write-Host "[3/4] Verificando estado da migração..." -ForegroundColor Yellow

$migrationCheck = docker-compose exec -T postgres psql -U postgres -d crm -t -A -c "SELECT finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20260121000000_add_semantic_service_tables';" 2>&1

# Determinar ação
Write-Host ""
Write-Host "[4/4] Aplicando correção..." -ForegroundColor Yellow

if ($tableCount -eq 3) {
    # As 3 tabelas existem - marcar como aplicada
    Write-Host "      Estratégia: MARCAR COMO APLICADA" -ForegroundColor Green
    Write-Host "      Motivo: Todas as tabelas foram criadas com sucesso" -ForegroundColor Gray
    Write-Host ""

    npm run db:migrate:resolve-applied

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Verificando status final..." -ForegroundColor Yellow
        npm run db:migrate:status

        Write-Host ""
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host "  SUCESSO! Migração corrigida." -ForegroundColor Green
        Write-Host "=============================================" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERRO ao marcar migração como aplicada!" -ForegroundColor Red
    }

} elseif ($tableCount -eq 0) {
    # Nenhuma tabela existe - rolar de volta e reaplicar
    Write-Host "      Estratégia: ROLAR DE VOLTA E REAPLICAR" -ForegroundColor Yellow
    Write-Host "      Motivo: Nenhuma tabela foi criada" -ForegroundColor Gray
    Write-Host ""

    npm run db:migrate:resolve-rollback

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Reaplicando migração..." -ForegroundColor Yellow
        npm run db:migrate:deploy

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host "  SUCESSO! Migração reaplicada." -ForegroundColor Green
            Write-Host "=============================================" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "ERRO ao reaplicar migração!" -ForegroundColor Red
        }
    } else {
        Write-Host ""
        Write-Host "ERRO ao rolar de volta migração!" -ForegroundColor Red
    }

} else {
    # Algumas tabelas existem - situação parcial
    Write-Host "      Estado: PARCIAL ($tableCount/3 tabelas)" -ForegroundColor Yellow
    Write-Host "      Isso indica que a migração foi aplicada parcialmente." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Recomendação:" -ForegroundColor Cyan
    Write-Host "  1. Se você quer manter as tabelas existentes:" -ForegroundColor White
    Write-Host "     npm run db:migrate:resolve-applied" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Se você quer limpar e reaplicar tudo:" -ForegroundColor White
    Write-Host "     npm run db:migrate:resolve-rollback" -ForegroundColor Gray
    Write-Host "     npm run db:migrate:deploy" -ForegroundColor Gray
    Write-Host ""

    $choice = Read-Host "Escolha [1] para manter ou [2] para limpar"

    if ($choice -eq "1") {
        npm run db:migrate:resolve-applied
        npm run db:migrate:status
    } elseif ($choice -eq "2") {
        npm run db:migrate:resolve-rollback
        npm run db:migrate:deploy
    } else {
        Write-Host "Opção inválida. Abortando." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Verificar se tudo está OK: npm run db:migrate:status" -ForegroundColor Gray
Write-Host "  2. Gerar Prisma Client: npm run db:generate" -ForegroundColor Gray
Write-Host "  3. Reiniciar o servidor: docker-compose restart api" -ForegroundColor Gray
Write-Host ""
