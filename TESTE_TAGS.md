# 🧪 Guia de Teste - Sistema de Tags

## Pré-requisitos
1. Backend rodando (`npm run dev` em `/backend`)
2. Frontend rodando (`npm run dev` em `/frontend`)
3. Banco de dados PostgreSQL ativo
4. Usuário logado no sistema

---

## 📝 Teste 1: Criar Cliente com Nova Tag

### Passos:
1. Acesse `/dashboard/customers`
2. Clique em "Novo Cliente"
3. Preencha:
   - Nome: `João Silva`
   - Telefone: `11999998888`
4. No campo "Tags":
   - Clique em "Selecionar tags..."
   - No campo inferior digite: `VIP`
   - Pressione Enter ou clique no botão +
5. Clique em "Criar Cliente"

### ✅ Resultado Esperado:
- Cliente criado com sucesso
- Tag "VIP" salva no cliente
- **IMPORTANTE:** Verifique o console do backend, deve aparecer:
  ```
  [Customer Controller] Create request: { companyId: '...', body: { name: 'João Silva', ... } }
  [Customer Service] Saving tags for customer: [ 'VIP' ]
  [Tag Service] Creating/getting tags: { companyId: '...', names: [ 'VIP' ] }
  [Tag Service] Tags created/retrieved: [ 'VIP' ]
  ```

---

## 📝 Teste 2: Verificar Tag Aparece na Lista

### Passos:
1. Ainda em `/dashboard/customers`
2. Clique em "Novo Cliente" novamente
3. No campo "Tags", clique em "Selecionar tags..."

### ✅ Resultado Esperado:
- Dropdown deve mostrar "Tags Existentes"
- Tag "VIP" deve aparecer na lista
- Ao clicar nela, checkbox deve marcar

---

## 📝 Teste 3: Criar Cliente Usando Tag Existente

### Passos:
1. Preencha:
   - Nome: `Maria Santos`
   - Telefone: `11999997777`
2. No campo "Tags":
   - Clique em "Selecionar tags..."
   - Selecione "VIP" da lista
   - Digite também uma nova tag: `Premium`
3. Clique em "Criar Cliente"

### ✅ Resultado Esperado:
- Cliente criado com ambas as tags: VIP e Premium
- Console do backend mostra salvamento de "Premium" (VIP já existe)
- Ao abrir o dropdown de tags novamente, deve mostrar: VIP e Premium

---

## 📝 Teste 4: Campanha com Tags

### Passos:
1. Acesse `/dashboard/campaigns`
2. Clique em "Nova Campanha"
3. Preencha:
   - Nome: `Promoção VIP`
   - Mensagem: `Olá! Promoção especial para você!`
4. Em "Tags Alvo", clique em "Selecionar tags..."

### ✅ Resultado Esperado:
- Dropdown deve mostrar as tags: VIP e Premium
- Ao selecionar "VIP", deve mostrar:
  - **Estimativa de alcance: 2 clientes** (João e Maria)
  - Tempo estimado de envio

---

## 📝 Teste 5: Editar Cliente e Adicionar Tag

### Passos:
1. Volte para `/dashboard/customers`
2. Clique em editar no cliente "João Silva"
3. Adicione nova tag: `Ouro`
4. Salve

### ✅ Resultado Esperado:
- Cliente atualizado
- Tag "Ouro" aparece no cliente
- Ao criar novo cliente, "Ouro" aparece no dropdown

---

## 🔍 Verificação no Banco de Dados

Execute no PostgreSQL:

```sql
-- Ver todas as tags cadastradas
SELECT * FROM tags ORDER BY created_at DESC;

-- Ver clientes com suas tags
SELECT id, name, phone, tags FROM customers ORDER BY created_at DESC;

-- Contar quantos clientes têm cada tag
SELECT
  unnest(tags) as tag,
  COUNT(*) as total
FROM customers
GROUP BY tag
ORDER BY total DESC;
```

---

## 🐛 Problemas Comuns e Soluções

### Problema: Tags não aparecem no dropdown
**Solução:**
1. Verifique console do backend se há erros
2. Teste endpoint manualmente: `GET /api/customers/tags`
3. Verifique se a tabela `tags` existe no banco

### Problema: Tags não salvam
**Solução:**
1. Verifique console do backend durante criação
2. Procure por logs: `[Tag Service] Creating/getting tags`
3. Verifique se o `tagService` está sendo chamado

### Problema: Erro ao criar campanha
**Solução:**
1. Verifique console do frontend para ver o payload
2. Verifique console do backend para ver validação
3. Certifique-se que `targetTags` é um array

---

## 📊 Logs Importantes para Verificar

### Backend (Terminal):
```
[Customer Controller] Create request: ...
[Customer Service] Saving tags for customer: ...
[Tag Service] Creating/getting tags: ...
[Tag Service] Tags created/retrieved: ...
```

### Frontend (DevTools Console):
```
Network Tab > Filtro: customers, campaigns
- POST /api/customers -> Body deve conter: { tags: ["VIP"] }
- GET /api/customers/tags -> Response deve conter: ["VIP", "Premium", "Ouro"]
```

---

## ✅ Checklist Final

- [ ] Tags são salvas ao criar cliente
- [ ] Tags são salvas ao editar cliente
- [ ] Tags aparecem no dropdown ao criar novo cliente
- [ ] Tags aparecem no dropdown de campanhas
- [ ] Estimativa de campanha calcula corretamente
- [ ] Múltiplas tags podem ser selecionadas
- [ ] Novas tags podem ser criadas via input manual
- [ ] Novas tags podem ser criadas via busca + "Criar tag"
- [ ] Tags duplicadas não são criadas (mesmo nome)
- [ ] Console do backend mostra logs de salvamento

---

## 🚀 Se Tudo Funcionar...

Parabéns! O sistema de tags está funcionando perfeitamente. Você pode:
- Deletar este arquivo se quiser
- Usar como referência para documentação
- Criar mais testes conforme necessário
