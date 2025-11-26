# Database Seed

Este diretório contém a configuração de seed do banco de dados.

## Executar Seed

```bash
npm run db:seed
```

## O que é criado

### 🏢 Empresa
- **Nome:** ClimaTech Ar Condicionado
- **Segmento:** Manutenção e instalação de ar condicionado
- **Localização:** São Paulo - SP

### 👤 Usuário Admin
- **Email:** teste@gmail.com
- **Senha:** senha123
- **Role:** ADMIN
- **Nome:** Admin ClimaTech

### 🤖 Configuração de IA
A IA está configurada com conhecimento completo sobre:
- Instalação de ar condicionado (Split, Janela, Multi-Split, Cassete)
- Manutenção preventiva (limpeza, higienização, carga de gás)
- Consertos (diagnóstico, troca de peças, reparos)
- Tabela de preços atualizada
- Políticas de agendamento e pagamento
- Horário de atendimento
- Contato e localização

**Modelo:** OpenAI GPT-4o-mini
**Temperature:** 0.7
**Max Tokens:** 500

### 🏷️ Tags Criadas
1. **VIP** (Dourado) - Clientes prioritários
2. **Urgente** (Vermelho) - Atendimento urgente
3. **Manutenção Preventiva** (Verde) - Contratos de manutenção
4. **Instalação** (Azul) - Instalações agendadas
5. **Conserto** (Laranja) - Consertos e reparos

### 👥 Clientes de Exemplo
1. **João Silva** - Cliente VIP com contrato mensal
2. **Maria Santos** - Aguardando instalação
3. **Carlos Oliveira** - Urgência de conserto

## Estrutura do Banco

O seed limpa todos os dados existentes antes de criar novos (em ordem de dependência):
1. ConversationExample
2. Conversation
3. Message
4. Customer
5. Campaign
6. Tag
7. WhatsAppInstance
8. AIKnowledge
9. User
10. Company

## Customização

Para customizar a seed, edite o arquivo `seed.ts`:

```typescript
// Alterar empresa
const company = await prisma.company.create({
  data: {
    name: 'Seu Nome de Empresa',
  },
});

// Alterar credenciais de login
const user = await prisma.user.create({
  data: {
    email: 'seu@email.com',
    passwordHash: await bcrypt.hash('suasenha', 10),
    // ...
  },
});

// Alterar conhecimento da IA
const aiKnowledge = await prisma.aIKnowledge.create({
  data: {
    companyInfo: 'Informações sobre sua empresa...',
    productsServices: 'Seus produtos e serviços...',
    // ...
  },
});
```

## Resetar Banco de Dados

Para limpar completamente o banco e recriar a estrutura:

```bash
# Resetar o banco e aplicar migrations
npx prisma migrate reset

# Ou apenas executar o seed novamente (limpa e recria dados)
npm run db:seed
```

## Verificar Dados

Para visualizar os dados criados:

```bash
npm run db:studio
```

Isso abrirá o Prisma Studio no navegador onde você pode visualizar e editar os dados.
