-- Verificar mensagens recentes
SELECT
  DATE(timestamp) as data,
  direction,
  "senderType",
  COUNT(*) as total
FROM "Message"
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp), direction, "senderType"
ORDER BY data DESC;

-- Verificar total de mensagens por empresa
SELECT
  c."companyId",
  COUNT(*) as total_mensagens,
  MAX(m.timestamp) as ultima_mensagem
FROM "Message" m
JOIN "Customer" c ON c.id = m."customerId"
GROUP BY c."companyId";
