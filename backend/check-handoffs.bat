@echo off
echo ======================================
echo Verificando conversas que transbordaram
echo ======================================
echo.

docker exec crm_db psql -U postgres -d crm -c "SELECT c.id, c.\"companyId\", c.\"needsHelp\", c.\"assignedToId\", cust.name, cust.phone FROM \"Conversation\" c JOIN \"Customer\" cust ON cust.id = c.\"customerId\" WHERE c.\"needsHelp\" = true ORDER BY c.\"updatedAt\" DESC LIMIT 10;"

echo.
echo ======================================
echo Contagem por empresa:
echo ======================================

docker exec crm_db psql -U postgres -d crm -c "SELECT c.\"companyId\", co.name, COUNT(*) as total, COUNT(CASE WHEN c.\"assignedToId\" IS NULL THEN 1 END) as unassigned FROM \"Conversation\" c JOIN \"Company\" co ON co.id = c.\"companyId\" WHERE c.\"needsHelp\" = true GROUP BY c.\"companyId\", co.name;"

pause
