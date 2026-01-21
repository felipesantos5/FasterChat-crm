# 🚀 CRM com Chatbot IA

Sistema SaaS de CRM (Customer Relationship Management) com chatbot de inteligência artificial integrado para automatizar e humanizar o atendimento ao cliente através de múltiplos canais (WhatsApp, Widget Web, Email).

## 📋 Índice

- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Desenvolvimento](#desenvolvimento)
- [Documentação](#documentação)

## 🛠 Stack Tecnológica

### Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma
- **Auth**: JWT (JSON Web Tokens)
- **Cache**: Redis
- **API WhatsApp**: Evolution API

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI)
- **Forms**: React Hook Form + Zod
- **State Management**: Zustand
- **Auth**: NextAuth.js
- **HTTP Client**: Axios

### AI/ML

- **LLM Tier 1**: GPT-4o Mini (OpenAI)
- **LLM Tier 2**: GPT-4o (OpenAI) / Claude Sonnet (Anthropic)

### DevOps

- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL (Docker)
- **Cache**: Redis (Docker)

## 📁 Estrutura do Projeto

```
crm/
├── backend/               # API Backend
│   ├── src/
│   │   ├── config/       # Configurações
│   │   ├── controllers/  # Controladores de rotas
│   │   ├── services/     # Lógica de negócio
│   │   ├── middlewares/  # Middlewares Express
│   │   ├── routes/       # Definição de rotas
│   │   ├── utils/        # Funções utilitárias
│   │   ├── types/        # Tipos TypeScript
│   │   └── server.ts     # Entry point
│   ├── prisma/
│   │   └── schema.prisma # Schema do banco
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/             # Frontend Next.js
│   ├── app/             # App Router
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/      # Componentes React
│   │   ├── ui/         # shadcn/ui components
│   │   ├── layout/     # Layout components
│   │   ├── forms/      # Form components
│   │   └── dashboard/  # Dashboard components
│   ├── lib/            # Utilitários
│   ├── types/          # Tipos TypeScript
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml   # Orquestração containers
├── PROJECT_SPEC.md     # Especificação completa
└── README.md           # Este arquivo
```

## ⚙️ Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18.0.0
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

## 📥 Instalação

### 1. Clone o repositório

```bash
git clone <repository-url>
cd crm
```

### 2. Inicie os serviços Docker

```bash
docker-compose up -d
```

Isso iniciará:

- PostgreSQL (porta 5432)
- Redis (porta 6379)

### 3. Configure o Backend

```bash
cd backend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Gere o Prisma Client
npm run db:generate

# Execute as migrations
npm run db:migrate
```

### 4. Configure o Frontend

```bash
cd ../frontend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite o arquivo .env.local com suas configurações
```

## 🚀 Desenvolvimento

### Iniciar Backend

```bash
cd backend
npm run dev
```

O backend estará rodando em: `http://localhost:3001`

### Iniciar Frontend

```bash
cd frontend
npm run dev
```

O frontend estará rodando em: `http://localhost:3000`

## 📚 Documentação

Para documentação técnica completa, incluindo:

- Objetivos e proposta de valor
- Arquitetura do sistema
- Regras de negócio
- Modelagem de dados
- Padrões de desenvolvimento
- Segurança
- Performance e escalabilidade
- Fluxos de processo
- APIs e integrações

Consulte o arquivo [PROJECT_SPEC.md](./PROJECT_SPEC.md)

## 🧪 Scripts Disponíveis

### Backend

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm start` - Inicia servidor de produção
- `npm run db:generate` - Gera Prisma Client
- `npm run db:migrate` - Executa migrations
- `npm run db:studio` - Abre Prisma Studio
- `npm test` - Executa testes
- `npm run lint` - Lint do código

### Frontend

- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm start` - Inicia servidor de produção
- `npm run lint` - Lint do código
- `npm run type-check` - Verificação de tipos

## 🔧 Configuração de Variáveis de Ambiente

### Backend (.env)

Principais variáveis:

- `DATABASE_URL` - URL de conexão PostgreSQL
- `JWT_SECRET` - Secret para tokens JWT
- `EVOLUTION_API_URL` - URL Evolution API (WhatsApp)

### Frontend (.env.local)

Principais variáveis:

- `NEXT_PUBLIC_API_URL` - URL da API backend
- `NEXTAUTH_URL` - URL do NextAuth
- `NEXTAUTH_SECRET` - Secret do NextAuth

Consulte os arquivos `.env.example` em cada pasta para a lista completa.

## 🐳 Docker

### Iniciar serviços

```bash
docker-compose up -d
```

### Parar serviços

```bash
docker-compose down
```

### Ver logs

```bash
docker-compose logs -f
```

### Resetar banco de dados

```bash
docker-compose down -v
docker-compose up -d
```

---

Desenvolvido com ❤️ para revolucionar o atendimento ao cliente
