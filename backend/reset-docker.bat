@echo off
REM Script para resetar completamente o ambiente Docker no Windows
REM USO: reset-docker.bat

echo [40;36m================================[0m
echo [40;36m  RESET DOCKER - CRM AI  [0m
echo [40;36m================================[0m
echo.

echo [33mParando containers...[0m
docker-compose down -v

echo.
echo [33mLimpando volumes orfaos...[0m
docker volume prune -f

echo.
echo [33mRemovendo volumes especificos...[0m
docker volume rm backend_postgres_data 2>nul
docker volume rm backend_postgres_evo_data 2>nul
docker volume rm backend_redis_data 2>nul
docker volume rm backend_evolution_instancesv2 2>nul

echo.
echo [33mVerificando volumes restantes...[0m
docker volume ls | findstr /C:"postgres" /C:"redis" /C:"evolution" || echo [32mNenhum volume relacionado encontrado[0m

echo.
echo [33mReconstruindo e subindo containers...[0m
docker-compose up -d --build

echo.
echo [33mAguardando inicializacao (10s)...[0m
timeout /t 10 /nobreak >nul

echo.
echo [33mVerificando status dos containers...[0m
docker-compose ps

echo.
echo [32m================================[0m
echo [32m  RESET COMPLETO![0m
echo [32m================================[0m
echo.
echo Para ver os logs: docker-compose logs -f api
echo.
pause
