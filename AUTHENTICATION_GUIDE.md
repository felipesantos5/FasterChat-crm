# Guia de Autenticação - CRM IA

Sistema de autenticação completo implementado com JWT e bcrypt.

## ✅ Implementação Completa

### Backend

#### 1. Models Prisma (`backend/prisma/schema.prisma`)
- **Company**: Empresa do usuário
  - `id`, `name`, `createdAt`, `updatedAt`
- **User**: Usuário do sistema
  - `id`, `email`, `passwordHash`, `name`, `role`, `companyId`
  - Roles: `ADMIN`, `MANAGER`, `AGENT`, `USER`

#### 2. Rotas Implementadas
```
POST /api/auth/signup
  Body: { name, email, password, companyName }
  Retorna: { user, token }

POST /api/auth/login
  Body: { email, password }
  Retorna: { user, token }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Retorna: { user }
```

#### 3. Serviços (`backend/src/services/auth.service.ts`)
- `signup()`: Cria usuário e empresa em transação
- `login()`: Valida credenciais e gera JWT
- `getUserById()`: Busca usuário por ID

#### 4. Middleware JWT (`backend/src/middlewares/auth.ts`)
- `authMiddleware`: Valida token JWT
- `requireRole()`: Valida permissões por role

#### 5. Utilitários
- `hashPassword()`: Hash de senha com bcrypt (10 rounds)
- `comparePassword()`: Valida senha
- `generateToken()`: Gera JWT (validade: 7 dias)
- `verifyToken()`: Valida JWT
- Validação Zod para signup e login

### Frontend

#### 1. Páginas
- `/login`: Página de login
- `/signup`: Página de cadastro
- `/dashboard`: Dashboard protegido

#### 2. Store Zustand (`frontend/lib/store/auth.store.ts`)
Estados:
- `user`: Dados do usuário
- `token`: JWT token
- `isAuthenticated`: Status de autenticação
- `isLoading`: Loading state

Ações:
- `login(email, password)`
- `signup(name, email, password, companyName)`
- `logout()`
- `loadUser()`: Carrega usuário do localStorage

#### 3. API Client (`frontend/lib/api.ts`)
- Configuração axios com interceptors
- Adiciona token automaticamente nos requests
- Redireciona para /login em 401

#### 4. Middleware Next.js (`frontend/middleware.ts`)
- Protege rotas `/dashboard/*`
- Redireciona para `/login` se não autenticado
- Redireciona para `/dashboard` se já autenticado em `/login` ou `/signup`

#### 5. AuthProvider (`frontend/components/providers/auth-provider.tsx`)
- Carrega usuário do localStorage ao iniciar
- Integrado no layout root

## 🚀 Como Testar

### 1. Iniciar Docker (PostgreSQL)

```bash
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar .env
cp .env.example .env
# Edite DATABASE_URL e JWT_SECRET

# Gerar Prisma Client
npm run db:generate

# Criar migrations
npm run db:migrate

# Iniciar servidor
npm run dev
```

Backend rodando em: `http://localhost:3001`

### 3. Setup Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Configurar .env.local
cp .env.example .env.local
# Edite NEXT_PUBLIC_API_URL

# Iniciar servidor
npm run dev
```

Frontend rodando em: `http://localhost:3000`

### 4. Testar Fluxo Completo

#### a) Criar Conta
1. Acesse: `http://localhost:3000/signup`
2. Preencha:
   - Nome: João Silva
   - Empresa: Minha Empresa LTDA
   - Email: joao@empresa.com
   - Senha: 123456
3. Clique em "Criar conta"
4. Será redirecionado para `/dashboard`

#### b) Fazer Logout
1. No dashboard, clique em "Sair"
2. Será redirecionado para `/login`

#### c) Fazer Login
1. Acesse: `http://localhost:3000/login`
2. Use as credenciais criadas
3. Será redirecionado para `/dashboard`

### 5. Testar API Diretamente (cURL/Postman)

#### Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@empresa.com",
    "password": "123456",
    "companyName": "Minha Empresa LTDA"
  }'
```

Resposta:
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "data": {
    "user": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "role": "ADMIN",
      "companyId": "uuid"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@empresa.com",
    "password": "123456"
  }'
```

#### Get Me (Rota Protegida)
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 🔒 Segurança Implementada

### Backend
- ✅ Senhas com hash bcrypt (10 rounds)
- ✅ JWT com secret forte e expiração
- ✅ Validação de dados com Zod
- ✅ Middleware de autenticação
- ✅ Helmet para headers de segurança
- ✅ CORS configurado

### Frontend
- ✅ Token armazenado em localStorage
- ✅ Token enviado em Authorization header
- ✅ Rotas protegidas com middleware
- ✅ Logout limpa token
- ✅ Validação de formulários
- ✅ Tratamento de erros

## 📋 Checklist de Validações

### Signup
- [x] Nome mínimo 2 caracteres
- [x] Email válido
- [x] Senha mínimo 6 caracteres
- [x] Empresa mínimo 2 caracteres
- [x] Email único (não duplicado)
- [x] Usuário criado como ADMIN
- [x] Empresa criada automaticamente

### Login
- [x] Email válido
- [x] Senha obrigatória
- [x] Verifica se usuário existe
- [x] Compara hash da senha
- [x] Gera JWT válido

### Proteção de Rotas
- [x] Dashboard requer autenticação
- [x] Token inválido redireciona para login
- [x] Token expirado redireciona para login
- [x] Login com token válido redireciona para dashboard

## 🎯 Próximos Passos

1. **Refresh Token**: Implementar refresh token para sessões longas
2. **Password Reset**: Fluxo de recuperação de senha
3. **Email Verification**: Verificação de email
4. **2FA**: Autenticação de dois fatores
5. **Session Management**: Gerenciamento de sessões ativas
6. **Rate Limiting**: Limitar tentativas de login
7. **Audit Log**: Log de atividades de autenticação

## 🐛 Troubleshooting

### Erro: "Email já está em uso"
- Email já cadastrado. Use outro email ou faça login.

### Erro: "Token inválido ou expirado"
- Faça logout e login novamente
- Verifique se JWT_SECRET é o mesmo no backend e frontend

### Erro: "Erro interno do servidor"
- Verifique se PostgreSQL está rodando
- Verifique logs do backend
- Verifique se migrations foram executadas

### Frontend não conecta ao backend
- Verifique NEXT_PUBLIC_API_URL no .env.local
- Verifique se backend está rodando na porta 3001
- Verifique CORS_ORIGIN no backend/.env

## 📚 Arquivos Principais

### Backend
```
backend/
├── prisma/schema.prisma          # Models
├── src/
│   ├── types/auth.ts             # TypeScript types
│   ├── utils/
│   │   ├── jwt.ts                # JWT utilities
│   │   ├── password.ts           # Bcrypt utilities
│   │   ├── validation.ts         # Zod schemas
│   │   └── prisma.ts             # Prisma client
│   ├── services/auth.service.ts  # Business logic
│   ├── controllers/auth.controller.ts  # Request handlers
│   ├── routes/auth.routes.ts     # Route definitions
│   ├── middlewares/auth.ts       # JWT middleware
│   └── server.ts                 # Express app
```

### Frontend
```
frontend/
├── app/
│   ├── login/page.tsx            # Login page
│   ├── signup/page.tsx           # Signup page
│   └── dashboard/page.tsx        # Protected dashboard
├── components/
│   ├── ui/                       # shadcn components
│   └── providers/auth-provider.tsx
├── lib/
│   ├── api.ts                    # Axios config
│   ├── auth.ts                   # Auth utilities
│   └── store/auth.store.ts       # Zustand store
├── types/auth.ts                 # TypeScript types
└── middleware.ts                 # Route protection
```
