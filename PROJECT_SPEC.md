# 🚀 CRM IA & Sales Engine - Especificação Técnica v3.0

## 1. Visão do Produto

### O que é

Um ecossistema de **Vendas e Relacionamento** via WhatsApp para empresas de serviços (foco inicial em Climatização/Ar Condicionado). O sistema transforma o WhatsApp de um canal de suporte passivo em uma **máquina ativa de vendas**.

### Pilares de Valor

1.  **Atendimento Híbrido (Sales-Driven AI):** Uma IA que não apenas tira dúvidas, mas tem o objetivo de _agendar visitas_ e _fechar orçamentos_, com transbordo inteligente para humanos.
2.  **CRM de Dados (Data-Driven):** Centralização de dados do cliente (origem, LTV, histórico) para decisões estratégicas.
3.  **Motor de Receita Recorrente (Active Marketing):** Automação de disparos para manutenção preventiva (ex: "Seu ar foi instalado há 6 meses, vamos limpar?") e campanhas promocionais segmentadas.

---

## 2. Objetivos e Métricas (KPIs)

### Objetivos de Negócio (O que o sistema deve entregar ao cliente final)

- **Aumento de Conversão:** Transformar >20% dos leads frios em agendamentos automáticos.
- **Recuperação de Base:** Gerar >R$ 5.000/mês em receitas de manutenção preventiva automática.
- **Organização:** Zero perda de leads por falta de resposta ou esquecimento.

### Objetivos Técnicos (Qualidade do Software)

- **Estabilidade do WhatsApp:** Conexão persistente com auto-healing (Evolution API v2).
- **Segurança de Envio:** Algoritmos de _throttling_ (atraso variável) em disparos em massa para evitar banimento do número.
- **Performance:** Respostas da IA em < 3s.

---

## 3. Stack Tecnológica e Padrões

### Backend

- **Runtime:** Node.js 20+ (TypeScript).
- **Framework:** Express.js (Leve, robusto).
- **Database:** PostgreSQL 16.
- **ORM:** Prisma (Schema-first design).
- **WhatsApp:** Evolution API v2 (Docker oficial `evoapicloud`).
- **AI:** OpenAI `gpt-4o-mini` (Custo-benefício) + `gpt-4o` (Casos complexos).
- **Queue/Jobs:** BullMQ + Redis (Para disparos em massa e agendamentos).

### Frontend

- **Framework:** Next.js 14 (App Router).
- **Estilo:** Tailwind CSS + Shadcn/ui.
- **State:** Zustand.
- **Data Fetching:** React Query ou SWR (para cache e real-time).

### 🛡️ Padrões de Qualidade de Código (Regras para a IA)

1.  **Service-Repository Pattern:**
    - _Controllers:_ Apenas recebem HTTP, validam (Zod) e chamam Services.
    - _Services:_ Contêm toda a regra de negócio.
    - _Utils/Helpers:_ Funções puras e reutilizáveis.
2.  **Tipagem Forte:** Não usar `any`. Criar interfaces/types para todas as entradas e saídas (DTOs).
3.  **Tratamento de Erros:** Try/Catch em todas as camadas async com logs estruturados.
4.  **Comentários:** Apenas o essencial (JSDoc em métodos complexos). O código deve ser autoexplicativo.
5.  **Clean Code:** Funções pequenas, responsabilidade única (SRP).

---

## 4. Modelagem de Dados (Schema Expansion)

O `schema.prisma` deve ser expandido para suportar CRM e Marketing.

### Novos Modelos / Campos Necessários

#### `Customer` (Enriquecido)

- `source`: Enum (ORGANIC, PAID_TRAFFIC, INDICATION, INFLUENCER, GOOGLE_ADS).
- `status`: Enum (LEAD, ACTIVE, CHURNED).
- `funnelStage`: Enum (NEW, QUALIFIED, NEGOTIATION, CLOSED, LOST).
- `lifetimeValue`: Decimal (Soma total gasta).
- `lastServiceDate`: DateTime (Para cálculo de manutenção).
- `nextMaintenanceDate`: DateTime (Previsão).

#### `Campaign` (Novo - Disparos)

- `id`: UUID.
- `name`: String (ex: "Promoção Inverno", "Lembrete Manutenção Junho").
- `type`: Enum (MANUAL, SCHEDULED, RECURRING).
- `status`: Enum (DRAFT, PENDING, PROCESSING, COMPLETED, FAILED).
- `messageTemplate`: String (com variáveis `{{name}}`).
- `targetTags`: String[] (Array de tags para segmentação).
- `scheduledAt`: DateTime.
- `stats`: JSON (Enviados, Lidos, Respondidos, Convertidos).

#### `ServiceOrder` (Novo - Vendas)

- `id`: UUID.
- `customerId`: FK.
- `value`: Decimal.
- `description`: String.
- `status`: Enum (OPEN, COMPLETED, CANCELED).
- `completedAt`: DateTime.

---

## 5. Regras de Negócio Detalhadas

### Módulo 1: Atendimento Inteligente (Sales AI)

1.  **Contexto Dinâmico:** O prompt da IA deve injetar dinamicamente:
    - Nome do cliente.
    - Histórico resumido das últimas 5 mensagens.
    - Produtos/Serviços da empresa (do `AIKnowledge`).
    - _Regra de Ouro:_ Se o cliente já conversou recentemente (< 24h), **não** saudar novamente ("Olá"), ir direto ao ponto.
2.  **Objetivo da Conversa:** A IA deve tentar conduzir o cliente para o fechamento (agendamento ou orçamento).
3.  **Transbordo (Hand-off):** Se detectar sentimento negativo ou solicitação complexa ("quero falar com humano", "processo"), desativar IA (`aiEnabled = false`) e notificar admins.

### Módulo 2: Gestão de Clientes (CRM)

1.  **Captura Automática:** Todo novo número que chama vira um `Customer` com status `LEAD`.
2.  **Etiquetagem (Tagging):** Permitir adicionar tags manualmente ou via IA (ex: IA detecta "interessado em instalação" -> adiciona tag `Interesse: Instalação`).
3.  **Funil:** Kanban visual no frontend para mover clientes de estágio.

### Módulo 3: Motor de Campanhas (Marketing Ativo)

1.  **Segmentação:** O usuário seleciona um grupo de Tags (ex: `Cliente Antigo` + `Bairro X`).
2.  **Agendamento:** O sistema deve permitir agendar o envio para data/hora futura.
3.  **Segurança de Envio (Anti-Ban):**
    - Não enviar tudo de uma vez.
    - Usar fila (Queue).
    - Adicionar `delay` aleatório entre 10s e 30s entre cada mensagem.
    - Respeitar limites diários configuráveis.
4.  **Variáveis:** Substituir `{{name}}` pelo primeiro nome do cliente para humanizar.

---

## 6. APIs e Integrações

### Endpoints Críticos (Backend)

#### Campanhas

- `POST /api/campaigns`: Criar campanha (rascunho ou agendada).
- `POST /api/campaigns/:id/start`: Iniciar disparo manual.
- `GET /api/campaigns/:id/stats`: Ver progresso em tempo real.

#### CRM

- `PATCH /api/customers/:id/tags`: Adicionar/Remover tags.
- `PATCH /api/customers/:id/pipeline`: Mudar estágio do funil.

#### Webhooks (Evolution API)

- Tratar eventos `SEND_MESSAGE` (para contabilizar disparos da campanha).
- Tratar eventos `MESSAGES_UPSERT` (para parar automação se o cliente responder durante uma campanha).

---

## 7. Segurança e Infraestrutura

1.  **Autenticação:** JWT com Refresh Token.
2.  **Multi-tenancy:** Todas as queries do Prisma devem ter `where: { companyId: req.user.companyId }` obrigatório.
3.  **Dados Sensíveis:** Nunca retornar senhas ou tokens de API no Frontend.
4.  **Docker:** Manter `docker-compose.yml` com healthchecks para garantir que o Evolution e Redis estejam sempre online.

---

## 8. Roadmap de Implementação (Sugestão)

1.  **Fase 1:** Refatoração do Prompt da IA (Contexto e Naturalidade). ✅
2.  **Fase 2:** Expansão do Banco de Dados (Tabelas Campaign, ServiceOrder).
3.  **Fase 3:** Frontend CRM (Gestão de Tags, Funil e Dados do Cliente).
4.  **Fase 4:** Motor de Disparos (Backend Queue + Frontend de Campanhas).
5.  **Fase 5:** Dashboard de ROI (Gráficos de conversão).
