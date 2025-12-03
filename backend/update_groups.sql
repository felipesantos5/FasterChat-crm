-- Atualiza todos os clientes que têm @g.us no telefone para isGroup = true
UPDATE customers 
SET is_group = true 
WHERE phone LIKE '%@g.us%' AND is_group = false;

-- Verifica quantos foram atualizados
SELECT COUNT(*) as grupos_atualizados 
FROM customers 
WHERE phone LIKE '%@g.us%';
