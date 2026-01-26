/**
 * ============================================
 * DEFAULT SYNONYMS - Dicionário de Sinônimos Padrão
 * ============================================
 *
 * Este arquivo contém mapeamentos de sinônimos para termos comuns
 * usados por clientes ao buscar serviços/produtos.
 *
 * Estrutura:
 * - canonicalTerm: Termo padrão/oficial usado internamente
 * - synonyms: Lista de variações que clientes costumam usar
 * - domain: Área de aplicação (opcional, para filtragem)
 *
 * IMPORTANTE: Estes sinônimos são globais e aplicados a todas as empresas.
 * Empresas podem adicionar sinônimos específicos via painel.
 */

export interface SynonymGroup {
  canonicalTerm: string;
  synonyms: string[];
  domain?: string;
}

export const DEFAULT_SYNONYMS: SynonymGroup[] = [
  // ==========================================
  // HVAC / Ar Condicionado
  // ==========================================
  {
    canonicalTerm: "ar condicionado",
    synonyms: [
      "ar frio",
      "split",
      "climatizador",
      "AC",
      "ar-condicionado",
      "ar",
      "arcondicionado",
      "aparelho de ar",
      "condicionador de ar",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "ar condicionado split",
    synonyms: [
      "split",
      "ar split",
      "aparelho split",
      "ar tipo split",
      "split inverter",
      "hi-wall",
      "hi wall",
      "hiwall",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "ar condicionado janela",
    synonyms: [
      "ar janela",
      "ar de janela",
      "janeleiro",
      "aparelho de janela",
      "ACJ",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "ar condicionado cassete",
    synonyms: [
      "cassete",
      "ar cassete",
      "k7",
      "ar embutido",
      "ar de teto",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "ar condicionado piso teto",
    synonyms: [
      "piso teto",
      "piso-teto",
      "ar piso teto",
      "floor ceiling",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "BTU",
    synonyms: [
      "btu",
      "btus",
      "9000",
      "9000 btus",
      "9k",
      "12000",
      "12000 btus",
      "12k",
      "18000",
      "18000 btus",
      "18k",
      "24000",
      "24000 btus",
      "24k",
      "30000",
      "30000 btus",
      "30k",
      "36000",
      "36000 btus",
      "36k",
      "48000",
      "48000 btus",
      "48k",
      "60000",
      "60000 btus",
      "60k",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "inverter",
    synonyms: [
      "inverter",
      "tecnologia inverter",
      "split inverter",
      "ar inverter",
      "economico",
      "econômico",
    ],
    domain: "HVAC",
  },

  // ==========================================
  // TIPOS DE SERVIÇO
  // ==========================================
  {
    canonicalTerm: "instalacao",
    synonyms: [
      "instalar",
      "instalação",
      "colocar",
      "montar",
      "montagem",
      "colocação",
      "instalando",
      "instala",
      "põe",
      "coloca",
      "botar",
    ],
  },
  {
    canonicalTerm: "manutencao",
    synonyms: [
      "manutenção",
      "conserto",
      "consertar",
      "arrumar",
      "reparo",
      "reparar",
      "defeito",
      "problema",
      "quebrado",
      "não funciona",
      "nao funciona",
      "parou de funcionar",
      "não liga",
      "nao liga",
      "com problema",
      "dando problema",
      "pifou",
      "estragou",
    ],
  },
  {
    canonicalTerm: "limpeza",
    synonyms: [
      "limpar",
      "higienização",
      "higienizacao",
      "higienizar",
      "lavagem",
      "lavar",
      "limpeza profunda",
      "limpa",
      "faz limpeza",
      "fazer limpeza",
    ],
  },
  {
    canonicalTerm: "desinstalacao",
    synonyms: [
      "desinstalar",
      "desinstalação",
      "remover",
      "remoção",
      "tirar",
      "retirar",
      "retirada",
      "desmontar",
      "desmontagem",
    ],
  },
  {
    canonicalTerm: "orcamento",
    synonyms: [
      "orçamento",
      "orçar",
      "cotação",
      "cotacao",
      "cotar",
      "avaliação",
      "avaliar",
      "visita técnica",
      "visita tecnica",
    ],
  },

  // ==========================================
  // PREÇO E VALOR
  // ==========================================
  {
    canonicalTerm: "preco",
    synonyms: [
      "preço",
      "valor",
      "custo",
      "quanto custa",
      "quanto é",
      "quanto fica",
      "qual o valor",
      "qual o preço",
      "quanto sai",
      "quanto dá",
      "quanto da",
      "tabela",
      "tabela de preços",
    ],
  },

  // ==========================================
  // AGENDAMENTO
  // ==========================================
  {
    canonicalTerm: "agendar",
    synonyms: [
      "marcar",
      "reservar",
      "horário",
      "horario",
      "agenda",
      "disponibilidade",
      "quando pode",
      "qual dia",
      "data disponível",
      "data disponivel",
      "marcar horário",
      "marcar horario",
      "agendar visita",
      "agendar serviço",
      "agendar servico",
      "marcar serviço",
      "marcar servico",
    ],
  },

  // ==========================================
  // URGÊNCIA
  // ==========================================
  {
    canonicalTerm: "urgente",
    synonyms: [
      "urgência",
      "urgencia",
      "emergência",
      "emergencia",
      "rápido",
      "rapido",
      "hoje",
      "agora",
      "imediato",
      "o mais rápido",
      "o mais rapido",
      "urgente",
      "prioridade",
    ],
  },

  // ==========================================
  // ELÉTRICA
  // ==========================================
  {
    canonicalTerm: "eletrica",
    synonyms: [
      "elétrica",
      "eletrico",
      "elétrico",
      "instalação elétrica",
      "instalacao eletrica",
      "parte elétrica",
      "parte eletrica",
      "fiação",
      "fiacao",
      "disjuntor",
      "quadro elétrico",
      "quadro eletrico",
    ],
    domain: "Eletrica",
  },
  {
    canonicalTerm: "infra",
    synonyms: [
      "infraestrutura",
      "infra-estrutura",
      "tubulação",
      "tubulacao",
      "canalização",
      "canalizacao",
      "canos",
      "dreno",
      "drenagem",
    ],
    domain: "Infra",
  },

  // ==========================================
  // PEÇAS E COMPONENTES
  // ==========================================
  {
    canonicalTerm: "gas",
    synonyms: [
      "gás",
      "recarga de gás",
      "recarga de gas",
      "fluido refrigerante",
      "refrigerante",
      "R410A",
      "R22",
      "r410",
      "r22",
      "carga de gás",
      "carga de gas",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "compressor",
    synonyms: [
      "motor",
      "compressor queimado",
      "compressor travado",
      "trocar compressor",
      "troca de compressor",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "filtro",
    synonyms: [
      "filtros",
      "filtro de ar",
      "troca de filtro",
      "trocar filtro",
      "limpeza de filtro",
    ],
    domain: "HVAC",
  },
  {
    canonicalTerm: "controle remoto",
    synonyms: [
      "controle",
      "comando",
      "controle sem fio",
      "controle não funciona",
      "controle nao funciona",
    ],
    domain: "HVAC",
  },

  // ==========================================
  // GARANTIA E ATENDIMENTO
  // ==========================================
  {
    canonicalTerm: "garantia",
    synonyms: [
      "garantia",
      "dentro da garantia",
      "período de garantia",
      "periodo de garantia",
      "coberto pela garantia",
      "tem garantia",
      "dá garantia",
      "da garantia",
    ],
  },
  {
    canonicalTerm: "atendimento",
    synonyms: [
      "suporte",
      "ajuda",
      "assistência",
      "assistencia",
      "falar com alguém",
      "falar com alguem",
      "atendente",
      "técnico",
      "tecnico",
      "profissional",
    ],
  },

  // ==========================================
  // PAGAMENTO
  // ==========================================
  {
    canonicalTerm: "pagamento",
    synonyms: [
      "pagar",
      "forma de pagamento",
      "parcelamento",
      "parcela",
      "parcelar",
      "cartão",
      "cartao",
      "pix",
      "boleto",
      "dinheiro",
      "à vista",
      "a vista",
      "desconto",
    ],
  },
];

export default DEFAULT_SYNONYMS;
