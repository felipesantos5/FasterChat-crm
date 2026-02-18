# 🚨 GUIA DE RECUPERAÇÃO DO POSTGRESQL EM PRODUÇÃO (COOLIFY)

## Problema
```
FATAL: password authentication failed for user "postgres"
```

## Solução Passo a Passo

### **PASSO 1: Fazer commit e push das alterações**

No seu computador local, execute:

```bash
cd c:\Users\felip\Documents\github\crm-ai\backend
git add docker-compose.yml
git commit -m "fix: enable postgres trust auth method temporarily"
git push origin main
```

### **PASSO 2: No Coolify, faça o redeploy**

1. Acesse o painel do Coolify
2. Vá até o seu projeto CRM
3. Clique em "Redeploy" ou "Deploy"
4. Aguarde o deploy completar

### **PASSO 3: Acesse o terminal do container PostgreSQL no Coolify**

No Coolify:
1. Vá em "Services" ou "Containers"
2. Encontre o container `crm_postgres`
3. Clique em "Terminal" ou "Shell"

### **PASSO 4: Execute este comando para resetar a senha**

No terminal do container PostgreSQL, execute:

```bash
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'admin123';"
```

Você deve ver a mensagem: `ALTER ROLE`

### **PASSO 5: Remova o modo trust (IMPORTANTE!)**

Volte para o seu computador local e reverta a alteração:

1. Edite o arquivo `docker-compose.yml`
2. Comente novamente a linha:
   ```yaml
   # POSTGRES_HOST_AUTH_METHOD: trust
   ```
3. Faça commit e push:
   ```bash
   git add docker-compose.yml
   git commit -m "fix: remove trust auth method after password reset"
   git push origin main
   ```

### **PASSO 6: Redeploy novamente no Coolify**

1. No Coolify, clique em "Redeploy" novamente
2. Aguarde o deploy completar
3. Verifique os logs do backend para confirmar que está conectando

### **PASSO 7: Verifique se está funcionando**

No Coolify, veja os logs do backend:
```bash
docker logs crm_backend
```

Você deve ver mensagens de sucesso na conexão com o banco.

---

## ⚠️ SOLUÇÃO ALTERNATIVA (Se a acima não funcionar)

Se você não tem dados importantes e pode resetar o banco:

### No Coolify:

1. **Pare todos os serviços**
2. **Delete os volumes:**
   - Vá em "Storages" ou "Volumes"
   - Delete `postgres_data`
   - Delete `postgres_evo_data`
3. **Reinicie os serviços**
4. **Execute as migrations:**
   ```bash
   docker exec -it crm_backend npx prisma migrate deploy
   ```

---

## 📝 Verificação Final

Após resolver, teste a conexão:

```bash
# No terminal do backend
docker exec -it crm_backend npx prisma db push
```

Se retornar sucesso, está tudo funcionando! ✅

---

## 🔐 Segurança

**IMPORTANTE:** Nunca deixe `POSTGRES_HOST_AUTH_METHOD: trust` em produção permanentemente! 
Isso permite conexões sem senha e é um risco de segurança.

Use apenas temporariamente para resetar a senha, depois remova.
