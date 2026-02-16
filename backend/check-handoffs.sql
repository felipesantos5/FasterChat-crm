-- Verificar conversas que transbordaram
SELECT
  c.id as conversation_id,
  c."companyId",
  c."customerId",
  c."needsHelp",
  c."assignedToId",
  c."updatedAt",
  cust.name as customer_name,
  cust.phone
FROM "Conversation" c
JOIN "Customer" cust ON cust.id = c."customerId"
WHERE c."needsHelp" = true
ORDER BY c."updatedAt" DESC;

-- Contar por empresa
SELECT
  c."companyId",
  co.name as company_name,
  COUNT(*) as total_handoffs,
  COUNT(CASE WHEN c."assignedToId" IS NULL THEN 1 END) as unassigned
FROM "Conversation" c
JOIN "Company" co ON co.id = c."companyId"
WHERE c."needsHelp" = true
GROUP BY c."companyId", co.name;
