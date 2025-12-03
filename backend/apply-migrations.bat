@echo off
echo ============================================
echo  Aplicando Migrations do Banco de Dados
echo ============================================
echo.

echo 1. Executando SQL para criar tabelas...
psql -U postgres -d crm -f create-google-calendar-tables.sql

echo.
echo 2. Gerando Prisma Client...
call npx prisma generate

echo.
echo ============================================
echo  Migrations aplicadas com sucesso!
echo ============================================
echo.
echo Agora voce pode reiniciar o servidor:
echo   npm run dev
echo.
pause
