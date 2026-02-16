@echo off
echo ======================================
echo Verificando mensagens no banco...
echo ======================================

docker exec crm_db psql -U postgres -d crm -c "SELECT DATE(timestamp) as data, direction, \"senderType\", COUNT(*) as total FROM \"Message\" WHERE timestamp >= NOW() - INTERVAL '7 days' GROUP BY DATE(timestamp), direction, \"senderType\" ORDER BY data DESC LIMIT 20;"

echo.
echo ======================================
echo Total de mensagens por empresa:
echo ======================================

docker exec crm_db psql -U postgres -d crm -c "SELECT c.\"companyId\", co.name as empresa, COUNT(*) as total_mensagens, MAX(m.timestamp) as ultima_mensagem FROM \"Message\" m JOIN \"Customer\" c ON c.id = m.\"customerId\" JOIN \"Company\" co ON co.id = c.\"companyId\" GROUP BY c.\"companyId\", co.name;"

pause
