# Plano de Melhorias para Sistema de IA 100% Confiável

## Resumo Executivo

Após análise detalhada do sistema de chat e atendimento da IA, identifiquei **15 pontos críticos** que precisam ser corrigidos para garantir um atendimento confiável. O sistema tem uma boa arquitetura, mas há problemas de implementação que afetam a experiência do cliente.

---

## Diagnóstico Atual

### O que funciona bem:
- Arquitetura de roteamento (IA normal vs agendamento)
- Sistema de tools para consultar produtos e horários
- Integração com Google Calendar
- Serviços com variáveis de preço
- Detecção de intenção de agendamento (restritiva, boa)

### O que precisa melhorar:
- FAQ nunca é usado
- Produtos duplicados no contexto
- Falta de fallback robusto
- Timeout inexistente
- Histórico do cliente não é usado

---

## Plano de Implementação

### FASE 1: CORREÇÕES CRÍTICAS (1-2 semanas)

#### 1.1 Injetar FAQ no Contexto da IA
**Problema:** O campo `faq` é salvo no banco mas NUNCA é injetado no prompt.

**Arquivo:** `backend/src/services/ai.service.ts`

**Solução:**
```typescript
// Adicionar na função buildOptimizedPrompt():
const faqSection = aiKnowledge?.faq && aiKnowledge.faq.length > 0
  ? `\n### ❓ PERGUNTAS FREQUENTES (FAQ)\n${this.formatFAQ(aiKnowledge.faq)}\n`
  : "";

// Adicionar função helper:
private formatFAQ(faq: any[]): string {
  return faq.map(item => `**P: ${item.question}**\nR: ${item.answer}\n`).join('\n');
}
```

**Impacto:** A IA vai responder perguntas frequentes com precisão.

---

#### 1.2 Remover Duplicação de Produtos
**Problema:** Se `products` (JSON) e `productsServices` (texto) existem, ambos são injetados.

**Arquivo:** `backend/src/services/ai.service.ts` (linhas 119-153)

**Solução:**
```typescript
private formatProductsForPrompt(productsJson: any, textDescription: string | null): string {
  // Prioriza JSON estruturado
  if (productsJson) {
    const products = Array.isArray(productsJson)
      ? productsJson
      : JSON.parse(...);

    if (products.length > 0) {
      // Formata apenas produtos JSON
      return this.formatProductsList(products);
    }
  }

  // Só usa texto como FALLBACK se não tiver JSON
  if (textDescription && textDescription.trim().length > 0) {
    return `### INFORMAÇÕES DE PRODUTOS\n${textDescription}\n`;
  }

  return "Nenhum produto cadastrado.";
}
```

**Impacto:** Economiza tokens e evita confusão da IA.

---

#### 1.3 Implementar Timeout na Geração de Resposta
**Problema:** Se `generateResponse()` travar, toda conversa fica pendurada.

**Arquivo:** `backend/src/services/ai.service.ts`

**Solução:**
```typescript
async generateResponse(...) {
  const TIMEOUT_MS = 30000; // 30 segundos

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('AI_TIMEOUT')), TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      this.processMessage(...),
      timeoutPromise
    ]);
  } catch (error) {
    if (error.message === 'AI_TIMEOUT') {
      return "Desculpe, estou com dificuldades no momento. Pode tentar novamente?";
    }
    throw error;
  }
}
```

**Impacto:** Cliente nunca fica sem resposta.

---

#### 1.4 Fallback Quando Google Calendar Não Está Conectado
**Problema:** Se Google Calendar não está configurado, sistema pode falhar silenciosamente.

**Arquivo:** `backend/src/services/ai-tools/handlers.ts`

**Solução:**
```typescript
export async function handleGetAvailableSlots(args) {
  // Verifica se Google Calendar está conectado
  const isGoogleCalendarConfigured = await googleCalendarService.isConfigured(companyId);

  if (!isGoogleCalendarConfigured) {
    // Fallback: usa horários baseados apenas no horário comercial
    const aiKnowledge = await prisma.aIKnowledge.findUnique({
      where: { companyId },
      select: { businessHoursStart: true, businessHoursEnd: true }
    });

    return {
      available: true,
      slots: generateDefaultSlots(aiKnowledge, preferred_date),
      message: "Horários sugeridos com base no horário comercial. Confirmação sujeita a disponibilidade.",
      warning: "Google Calendar não conectado - horários são apenas sugestões."
    };
  }

  // ... continua com fluxo normal do Google Calendar
}
```

**Impacto:** Mesmo sem Google Calendar, cliente consegue agendar.

---

### FASE 2: MELHORIAS DE CONTEXTO (2-3 semanas)

#### 2.1 Usar Histórico do Cliente
**Problema:** `get_customer_history` está na definição mas não implementado.

**Arquivo:** `backend/src/services/ai-tools/handlers.ts`

**Solução:**
```typescript
export async function handleGetCustomerHistory(args: {
  customerId: string;
  companyId: string;
}) {
  const { customerId } = args;

  // Busca últimos agendamentos
  const appointments = await prisma.appointment.findMany({
    where: { customerId },
    orderBy: { startTime: 'desc' },
    take: 5,
    select: {
      title: true,
      startTime: true,
      type: true,
      status: true,
      notes: true
    }
  });

  // Busca dados do cliente
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, tags: true, notes: true, createdAt: true }
  });

  return {
    customer: {
      name: customer?.name,
      tags: customer?.tags,
      notes: customer?.notes,
      clientSince: customer?.createdAt
    },
    recentAppointments: appointments.map(a => ({
      service: a.title,
      date: format(a.startTime, 'dd/MM/yyyy'),
      status: a.status,
      notes: a.notes
    })),
    instruction: "Use essas informações para personalizar o atendimento."
  };
}
```

**Impacto:** IA pode dizer "Vejo que você já fez uma instalação conosco em dezembro..."

---

#### 2.2 Adicionar Tool `get_customer_history` ao essentialTools
**Arquivo:** `backend/src/services/ai-tools/index.ts`

```typescript
export const getCustomerHistoryTool = {
  type: 'function' as const,
  function: {
    name: 'get_customer_history',
    description: 'Busca histórico do cliente atual: agendamentos anteriores, tags, notas. Use para personalizar o atendimento.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

export const essentialTools = [
  getAvailableSlotsTool,
  createAppointmentTool,
  getProductInfoTool,
  calculateQuoteTool,
  getCustomerHistoryTool,  // ADICIONAR
  getCompanyPolicyTool     // ADICIONAR (já existe mas não está no array)
];
```

---

#### 2.3 Melhorar Detecção de Data/Hora em Uma Mensagem
**Problema:** Cliente diz "Quero agendar amanhã às 14h na Rua X, 123" e sistema ignora.

**Arquivo:** `backend/src/services/ai-appointment.service.ts`

**Solução:**
```typescript
async startAppointmentFlow(customerId: string, companyId: string, message: string) {
  // Detecta tudo de uma vez
  const detected = {
    serviceType: this.detectServiceType(message),
    date: this.detectDate(message),
    time: this.detectTime(message),
    address: this.detectAddress(message)
  };

  // Se já tem tudo, pula direto para confirmação
  if (detected.serviceType && detected.date && detected.time && detected.address?.street) {
    const state: AppointmentState = {
      step: 'CONFIRMING',
      serviceType: detected.serviceType,
      date: detected.date,
      time: detected.time,
      address: detected.address
    };

    await this.saveAppointmentState(customerId, state);

    return {
      response: `Perfeito! Vou confirmar os dados:
📅 ${this.formatDate(detected.date)} às ${detected.time}
📍 ${this.formatAddress(detected.address)}
🔧 ${this.getServiceTypeLabel(detected.serviceType)}

Está tudo certo? Responda SIM para confirmar.`
    };
  }

  // ... continua com fluxo normal se não tem tudo
}
```

**Impacto:** Agendamento mais rápido quando cliente já diz tudo.

---

#### 2.4 Cleanup de Estados de Agendamento Antigos
**Problema:** Estados ficam pendurados para sempre.

**Arquivo:** `backend/src/services/ai-appointment.service.ts`

**Solução:**
```typescript
// Adicionar verificação no getAppointmentState:
async getAppointmentState(customerId: string): Promise<AppointmentState | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { customerId },
    select: { appointmentState: true, updatedAt: true }
  });

  if (!conversation?.appointmentState) return null;

  // Expira estados com mais de 24 horas
  const stateAge = Date.now() - new Date(conversation.updatedAt).getTime();
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas

  if (stateAge > MAX_AGE) {
    await this.clearAppointmentState(customerId);
    console.log(`[AIAppointment] Estado expirado após 24h para ${customerId}`);
    return null;
  }

  return conversation.appointmentState as AppointmentState;
}
```

**Impacto:** Estados não ficam "travados" indefinidamente.

---

### FASE 3: OTIMIZAÇÕES DE PROMPT (1-2 semanas)

#### 3.1 Manter Formatação WhatsApp
**Problema:** `removeMarkdown()` remove todo o bold/italic.

**Arquivo:** `backend/src/services/ai.service.ts`

**Solução:**
```typescript
private formatForWhatsApp(text: string): string {
  return text
    // Converte **bold** para *bold* (WhatsApp usa asterisco simples)
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // Remove headers markdown
    .replace(/^#{1,6}\s+/gm, '')
    // Mantém listas
    .replace(/^[-*]\s+/gm, '• ')
    // Remove links markdown mas mantém texto
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}
```

**Impacto:** Respostas com formatação bonita no WhatsApp.

---

#### 3.2 Ajustar MAX_TOKENS para Orçamentos
**Problema:** 500 tokens é insuficiente para orçamentos detalhados.

**Arquivo:** `backend/src/services/ai.service.ts`

**Solução:**
```typescript
const CHATBOT_CONFIG = {
  MAX_TOKENS: 800,  // Aumentar de 500 para 800
  // ...
};
```

**Impacto:** Orçamentos completos sem corte.

---

#### 3.3 Instruções de Transbordo Explícitas
**Problema:** IA não sabe quando encaminhar para humano.

**Solução:** Adicionar ao prompt:
```typescript
const transbordoSection = `
### 🚨 QUANDO ENCAMINHAR PARA HUMANO
Se você não conseguir resolver o problema do cliente, responda com:
"[TRANSBORDO] Vou transferir você para um de nossos atendentes."

Situações para transbordo:
- Cliente reclamando de problema sério
- Assuntos financeiros/reembolsos
- Perguntas que você não tem resposta
- Cliente pede explicitamente por humano
- Discussões complexas que fogem do seu conhecimento
`;
```

---

### FASE 4: MONITORAMENTO E QUALIDADE (Contínuo)

#### 4.1 Implementar Logging Estruturado
```typescript
// Criar arquivo: backend/src/utils/ai-logger.ts
export const aiLogger = {
  logToolCall: (toolName: string, args: any, result: any, duration: number) => {
    console.log(JSON.stringify({
      type: 'AI_TOOL_CALL',
      timestamp: new Date().toISOString(),
      tool: toolName,
      args,
      success: !result.error,
      durationMs: duration
    }));
  },

  logResponse: (customerId: string, message: string, response: string, tokens: number) => {
    console.log(JSON.stringify({
      type: 'AI_RESPONSE',
      timestamp: new Date().toISOString(),
      customerId,
      inputLength: message.length,
      outputLength: response.length,
      estimatedTokens: tokens
    }));
  }
};
```

#### 4.2 Métricas de Qualidade
Implementar dashboard com:
- Taxa de uso de ferramentas
- Tempo médio de resposta
- Taxa de transbordo
- Erros por tipo
- Agendamentos bem-sucedidos vs falhos

---

## Matriz de Priorização

| Tarefa | Impacto | Esforço | Prioridade |
|--------|---------|---------|------------|
| 1.1 Injetar FAQ | Alto | Baixo | **P0** |
| 1.2 Remover duplicação | Médio | Baixo | **P0** |
| 1.3 Timeout | Alto | Baixo | **P0** |
| 1.4 Fallback Calendar | Alto | Médio | **P0** |
| 2.1 Histórico cliente | Alto | Médio | **P1** |
| 2.3 Detecção múltipla | Médio | Alto | **P1** |
| 2.4 Cleanup estados | Médio | Baixo | **P1** |
| 3.1 Formatação WhatsApp | Baixo | Baixo | **P2** |
| 3.2 MAX_TOKENS | Médio | Baixo | **P2** |
| 3.3 Instruções transbordo | Médio | Baixo | **P2** |
| 4.1 Logging | Médio | Médio | **P2** |

---

## Cronograma Sugerido

```
SEMANA 1: P0 (Correções Críticas)
├── Dia 1-2: FAQ + Duplicação de produtos
├── Dia 3-4: Timeout + Fallback Calendar
└── Dia 5: Testes e ajustes

SEMANA 2: P1 (Melhorias de Contexto)
├── Dia 1-2: Histórico do cliente
├── Dia 3-4: Detecção múltipla + Cleanup
└── Dia 5: Testes e ajustes

SEMANA 3: P2 (Otimizações)
├── Dia 1-2: Formatação + MAX_TOKENS
├── Dia 3: Instruções de transbordo
├── Dia 4-5: Logging e monitoramento
```

---

## Checklist de Validação

Após implementar, testar os seguintes cenários:

### Cenário 1: Perguntas sobre Produtos
- [ ] "Vocês vendem ar condicionado?" → IA usa get_product_info e responde com detalhes
- [ ] "Quanto custa instalação?" → IA busca produto e retorna preço exato
- [ ] "O que é manutenção preventiva?" → IA usa descrição do produto

### Cenário 2: FAQ
- [ ] "Qual política de garantia?" → IA responde do FAQ
- [ ] "Vocês fazem troca?" → IA responde do FAQ
- [ ] "Como funciona o pagamento?" → IA responde do FAQ

### Cenário 3: Agendamento
- [ ] "Quero agendar" → Inicia fluxo
- [ ] "Quero agendar amanhã às 14h" → Detecta data e hora
- [ ] "Quais horários tem na sexta?" → Usa get_available_slots
- [ ] Google Calendar desconectado → Mostra horários sugeridos

### Cenário 4: Orçamento com Variáveis
- [ ] "Quanto custa instalação de 12000 BTUs?" → Calcula com variáveis
- [ ] "Preciso de manutenção split" → Mostra preço base + variáveis

### Cenário 5: Transbordo
- [ ] "Quero falar com um humano" → Encaminha
- [ ] Pergunta que IA não sabe → Encaminha

---

## Conclusão

Com estas melhorias, o sistema terá:

1. **Respostas precisas** - Usando FAQ + produtos estruturados
2. **Agendamento robusto** - Com fallback e timeout
3. **Personalização** - Usando histórico do cliente
4. **Monitoramento** - Para identificar problemas rapidamente
5. **Escalabilidade** - Código limpo e bem estruturado

O investimento estimado é de **3 semanas de desenvolvimento** para atingir 100% de confiabilidade.
