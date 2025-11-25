@echo off
REM Script para reconfigurar webhook da Evolution API (Windows)

SET EVOLUTION_URL=http://localhost:8088
SET EVOLUTION_API_KEY=crm-api-key-secure-2024
SET WEBHOOK_URL=http://host.docker.internal:3001/api/webhooks/whatsapp

echo.
echo 🔧 Reconfigurar Webhook da Evolution API
echo.
set /p INSTANCE_NAME="Digite o nome da instancia (ex: instance_123): "

if "%INSTANCE_NAME%"=="" (
  echo ❌ Nome da instancia nao pode ser vazio!
  pause
  exit /b 1
)

echo.
echo 📋 Configuracoes:
echo    Evolution URL: %EVOLUTION_URL%
echo    Instance: %INSTANCE_NAME%
echo    Webhook URL: %WEBHOOK_URL%
echo.

echo 🔄 Configurando webhook...
curl -X POST "%EVOLUTION_URL%/webhook/set/%INSTANCE_NAME%" ^
  -H "apikey: %EVOLUTION_API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"url\": \"%WEBHOOK_URL%\", \"enabled\": true, \"webhook_by_events\": false, \"webhook_base64\": false, \"events\": [\"MESSAGES_UPSERT\", \"MESSAGES_UPDATE\", \"CONNECTION_UPDATE\", \"QRCODE_UPDATED\", \"STATUS_INSTANCE\", \"SEND_MESSAGE\"], \"webhook_headers\": {\"X-Webhook-Secret\": \"your-webhook-secret-key\"}}"

echo.
echo.
echo ✅ Webhook reconfigurado!
echo.

echo 🔍 Verificando configuracao...
curl "%EVOLUTION_URL%/webhook/find/%INSTANCE_NAME%" ^
  -H "apikey: %EVOLUTION_API_KEY%"

echo.
echo.
echo 📝 Proximos passos:
echo    1. Verifique se o webhook esta com URL correta acima
echo    2. Teste enviando uma mensagem do WhatsApp
echo    3. Verifique os logs do backend (npm run dev)
echo.
pause
