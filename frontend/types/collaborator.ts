export interface Permission {
  page: string;
  canView: boolean;
  canEdit: boolean;
}

export interface Collaborator {
  id: string;
  email: string;
  name: string;
  cargo?: string;
  role: string;
  status: string;
  createdAt: string;
  permissions: Permission[];
}

export interface PendingInvite {
  id: string;
  email: string;
  name: string;
  cargo?: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  permissions: Permission[];
  invitedBy: { name: string };
}

export interface PermissionPageDef {
  value: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  label: string;
  pages: PermissionPageDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Operacional',
    pages: [
      {
        value: 'DASHBOARD',
        label: 'Dashboard',
        description: 'Painel principal com métricas, resumo de atendimentos e indicadores do dia.',
      },
      {
        value: 'CONVERSATIONS',
        label: 'Conversas',
        description: 'Atendimento em tempo real, histórico de mensagens e transbordo humano.',
      },
      {
        value: 'CUSTOMERS',
        label: 'Clientes',
        description: 'Cadastro, edição e visualização do perfil completo de cada cliente.',
      },
      {
        value: 'PIPELINE',
        label: 'Funil de Vendas',
        description: 'Kanban de oportunidades com arrastar e soltar entre etapas do funil.',
      },
      {
        value: 'CALENDAR',
        label: 'Calendário',
        description: 'Agendamentos, compromissos e integração com Google Agenda.',
      },
    ],
  },
  {
    label: 'Marketing & Automação',
    pages: [
      {
        value: 'CAMPAIGNS',
        label: 'Campanhas',
        description: 'Criação e disparo de campanhas de mensagens em massa para listas de contatos.',
      },
      {
        value: 'WHATSAPP_LINKS',
        label: 'Links WhatsApp',
        description: 'Geração e rastreamento de links de entrada no WhatsApp com métricas de cliques.',
      },
      {
        value: 'FLOWS',
        label: 'Fluxos de Automação',
        description: 'Editor visual de fluxos, disparo em massa via planilha e automações por gatilho.',
      },
    ],
  },
  {
    label: 'Inteligência Artificial',
    pages: [
      {
        value: 'AI_INSIGHTS',
        label: 'IA — Insights & Exemplos',
        description: 'Análise de conversas por IA, exemplos de treinamento e relatórios de performance.',
      },
      {
        value: 'AI_CONFIG',
        label: 'IA — Configurações',
        description: 'Prompt do agente, base de conhecimento, scripts de atendimento e personalidade.',
      },
    ],
  },
  {
    label: 'Configurações',
    pages: [
      {
        value: 'WHATSAPP_CONFIG',
        label: 'WhatsApp',
        description: 'Gerenciamento de instâncias, conexões e estratégia de envio de mensagens.',
      },
    ],
  },
];

// Flat list mantida para compatibilidade com código legado
export const PERMISSION_PAGES = PERMISSION_GROUPS.flatMap((g) => g.pages);
