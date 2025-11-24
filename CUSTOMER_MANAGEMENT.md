# Gestão de Clientes - CRM IA

Sistema completo de gestão de clientes (CRUD) com tags, busca e filtros.

## ✅ Implementação Completa

### BACKEND

#### 1. Model Prisma (`backend/prisma/schema.prisma`)

```prisma
model Customer {
  id         String   @id @default(uuid())
  companyId  String   @map("company_id")
  name       String
  phone      String
  email      String?
  tags       String[] @default([])
  notes      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  company    Company  @relation(...)

  @@unique([companyId, phone])  // Phone único por empresa
  @@index([companyId])
  @@index([phone])
  @@index([email])
}
```

**Features:**
- ✅ Telefone único por empresa (@@unique)
- ✅ Tags como array de strings
- ✅ Email e notes opcionais
- ✅ Índices para otimização

#### 2. API Endpoints (`/api/customers`)

Todas as rotas protegidas com JWT:

```typescript
POST   /api/customers           // Criar cliente
GET    /api/customers           // Listar com filtros
GET    /api/customers/stats     // Estatísticas
GET    /api/customers/tags      // Todas as tags
GET    /api/customers/:id       // Detalhes
PUT    /api/customers/:id       // Atualizar
DELETE /api/customers/:id       // Excluir
```

#### 3. Service Layer (`backend/src/services/customer.service.ts`)

**Métodos:**
- `create()` - Valida phone único por empresa
- `findAll()` - Busca com filtros (search, tags, paginação)
- `findById()` - Busca por ID e companyId
- `update()` - Valida phone antes de atualizar
- `delete()` - Verifica permissão antes de excluir
- `getStats()` - Retorna total, thisMonth, tags populares
- `getAllTags()` - Lista todas tags únicas

**Validações:**
- Phone único por empresa
- Validação de dados com Zod
- Verificação de permissões (companyId)

#### 4. Validação Zod (`backend/src/utils/validation.customer.ts`)

```typescript
createCustomerSchema = {
  name: min 2 caracteres,
  phone: regex internacional,
  email: email válido (opcional),
  tags: array de strings,
  notes: string (opcional)
}
```

### FRONTEND

#### 1. Página de Lista (`/dashboard/customers`)

**Features:**
- ✅ Grid de cards responsivo (2 cols md, 3 cols lg)
- ✅ Busca em tempo real (nome, phone, email)
- ✅ Filtros por tags (múltiplas)
- ✅ Botão "Novo Cliente"
- ✅ Dropdown menu em cada card (ver, editar, excluir)
- ✅ Empty states (sem clientes, sem resultados)

**Card do Cliente:**
```
[Nome do Cliente]               [Menu ⋮]
📞 +55 11 99999-9999
📧 cliente@email.com
[VIP] [Cliente] [Premium]        <- Tags coloridas
"Observações sobre o cliente..."
```

#### 2. Modal de Formulário (`CustomerFormModal`)

**Campos:**
- Nome * (obrigatório)
- Telefone * (obrigatório)
- Email (opcional)
- Tags (input com chips + autocomplete)
- Observações (textarea)

**Features:**
- ✅ React Hook Form + Zod validation
- ✅ Modo criar/editar (reutilizável)
- ✅ TagInput com autocomplete
- ✅ Suggestions das tags existentes
- ✅ Loading states
- ✅ Error handling

#### 3. Tag Input Component (`TagInput`)

**Features:**
- ✅ Input com autocomplete
- ✅ Chips coloridos (cores fixas por tag)
- ✅ Adicionar: Enter ou click
- ✅ Remover: Backspace ou click no X
- ✅ Dropdown de sugestões
- ✅ Filtra sugestões baseado no texto
- ✅ Não permite duplicatas

**Cores de Tags:**
```typescript
VIP      → gold (yellow)
Novo     → blue
Premium  → purple
Ativo    → green
Inativo  → gray
Lead     → orange
Cliente  → teal
Prospect → indigo
Importante → red
Default  → slate
```

#### 4. Página de Detalhes (`/dashboard/customers/[id]`)

**Seções:**
1. **Header**
   - Botão voltar
   - Nome do cliente
   - Botões: Editar, Excluir

2. **Informações de Contato** (card principal)
   - Telefone com ícone
   - Email com ícone
   - Data de cadastro
   - Tags

3. **Estatísticas** (sidebar)
   - Total de conversas
   - Última interação
   - Última atualização

4. **Observações** (card)
   - Texto completo das notas

5. **Histórico de Atividades** (card)
   - Placeholder para futuras conversas

## 🎨 Design Features

### Cores de Tags
Tags com cores fixas para identificação rápida:
- **VIP**: Fundo amarelo claro
- **Novo**: Fundo azul claro
- **Premium**: Fundo roxo claro
- **Ativo**: Fundo verde claro
- Outras: Cores definidas em `lib/constants/tags.ts`

### Componentes UI Criados
- ✅ `Dialog` - Modal completo (Radix UI)
- ✅ `Badge` - Tags/chips coloridos
- ✅ `Textarea` - Campo de texto multilinha
- ✅ `TagInput` - Input customizado com autocomplete

### Responsividade
```css
Cards Grid:
- Mobile: 1 coluna
- md: 2 colunas
- lg: 3 colunas

Detalhes:
- Mobile: Stack vertical
- md: Grid 2 cols (info) + 1 col (stats)
```

## 🚀 Como Testar

### 1. Executar Migrations

```bash
cd backend
npm run db:migrate
```

### 2. Iniciar Backend

```bash
cd backend
npm run dev
```

Backend: `http://localhost:3001`

### 3. Iniciar Frontend

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`

### 4. Testar Funcionalidades

#### a) Criar Cliente
1. Faça login
2. Vá para "Clientes" no menu
3. Clique em "+ Novo Cliente"
4. Preencha:
   - Nome: João Silva
   - Telefone: +5511999999999
   - Email: joao@email.com
   - Tags: VIP, Cliente (digite e pressione Enter)
   - Notas: Cliente importante
5. Clique em "Criar Cliente"

#### b) Buscar Cliente
1. Digite na barra de busca: "João"
2. Resultados filtrados em tempo real

#### c) Filtrar por Tags
1. Clique em uma tag no filtro
2. Apenas clientes com aquela tag aparecem
3. Clique em múltiplas tags para filtro AND
4. "Limpar filtros" remove todos

#### d) Editar Cliente
1. Clique no menu (⋮) do card
2. Selecione "Editar"
3. Altere os dados
4. Clique em "Salvar Alterações"

#### e) Ver Detalhes
1. Clique no menu (⋮) do card
2. Selecione "Ver detalhes"
3. Veja todas informações completas

#### f) Excluir Cliente
1. No card ou na página de detalhes
2. Clique em "Excluir"
3. Confirme a exclusão

### 5. Testar API Diretamente

#### Criar Cliente
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "+5511999999999",
    "email": "joao@email.com",
    "tags": ["VIP", "Cliente"],
    "notes": "Cliente importante"
  }'
```

#### Listar Clientes
```bash
curl http://localhost:3001/api/customers?search=João \
  -H "Authorization: Bearer SEU_TOKEN"
```

#### Buscar Tags
```bash
curl http://localhost:3001/api/customers/tags \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 📋 Validações Implementadas

### Backend
- [x] Nome: mínimo 2 caracteres
- [x] Telefone: regex internacional
- [x] Email: formato válido (opcional)
- [x] Phone único por empresa
- [x] Tags: array de strings
- [x] Verificação de companyId em todas operações

### Frontend
- [x] Validação com Zod
- [x] Feedback visual de erros
- [x] Loading states
- [x] Confirmação antes de excluir
- [x] Previne duplicação de tags
- [x] Trim em strings

## 🎯 Features Implementadas

### CRUD Completo
- [x] Create (POST)
- [x] Read List (GET com filtros)
- [x] Read One (GET por ID)
- [x] Update (PUT)
- [x] Delete (DELETE)

### Busca e Filtros
- [x] Busca por nome (case insensitive)
- [x] Busca por telefone
- [x] Busca por email
- [x] Filtro por múltiplas tags
- [x] Paginação (backend ready)

### Tags System
- [x] Tags como array
- [x] Cores fixas por tag
- [x] Autocomplete de tags existentes
- [x] Endpoint GET /tags
- [x] Chips clicáveis para filtrar
- [x] Remover tag com X

### UX/UI
- [x] Modal responsivo
- [x] Cards com hover effect
- [x] Dropdown menu em cada card
- [x] Empty states informativos
- [x] Loading indicators
- [x] Confirmações de delete
- [x] Navegação breadcrumb-like

## 🔐 Segurança

- ✅ Todas rotas protegidas com JWT
- ✅ Validação de companyId (multi-tenancy)
- ✅ Unique constraint (companyId + phone)
- ✅ Sanitização de inputs (Zod)
- ✅ SQL injection protected (Prisma)

## 📊 Estatísticas

Endpoint `/api/customers/stats` retorna:
```typescript
{
  total: number,           // Total de clientes
  thisMonth: number,       // Clientes este mês
  tags: Array<{            // Top 10 tags
    tag: string,
    count: number
  }>
}
```

## 🎨 Arquivos Criados

### Backend
```
backend/src/
├── types/customer.ts
├── utils/validation.customer.ts
├── services/customer.service.ts
├── controllers/customer.controller.ts
└── routes/customer.routes.ts

backend/prisma/
└── schema.prisma (+ Customer model)
```

### Frontend
```
frontend/
├── types/customer.ts
├── lib/
│   ├── customer.ts
│   └── constants/tags.ts
├── components/
│   ├── ui/
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   └── textarea.tsx
│   └── forms/
│       ├── tag-input.tsx
│       └── customer-form-modal.tsx
└── app/dashboard/customers/
    ├── page.tsx
    └── [id]/page.tsx
```

## 🐛 Troubleshooting

### Erro: "Telefone já cadastrado"
- Cada empresa pode ter apenas 1 cliente por telefone
- Verifique se o telefone já existe
- Unique constraint: `[companyId, phone]`

### Tags não aparecem no autocomplete
- Certifique-se de ter criado clientes com tags
- Endpoint `/api/customers/tags` retorna todas tags únicas
- Tags são case-sensitive

### Busca não funciona
- Busca é case-insensitive
- Busca em: name, phone, email
- Filtra por companyId automaticamente

### Modal não abre/fecha
- Verifique se Dialog (Radix UI) está instalado
- Estado `open` controla visibilidade
- `onClose` deve atualizar o estado

## 🎯 Próximos Passos

### Melhorias
1. **Paginação**: Implementar no frontend
2. **Import/Export**: CSV/Excel de clientes
3. **Avatar**: Upload de foto do cliente
4. **Custom Fields**: Campos personalizados por empresa
5. **Histórico**: Log de alterações
6. **Merge**: Unir clientes duplicados

### Integrações
1. **WhatsApp**: Vincular conversas ao cliente
2. **Email**: Enviar emails direto do CRM
3. **Calendar**: Agendar follow-ups

---

**Sistema de Gestão de Clientes completo!** 🎉

Todos os endpoints funcionando, frontend responsivo, tags com cores, busca em tempo real, e validações completas.
