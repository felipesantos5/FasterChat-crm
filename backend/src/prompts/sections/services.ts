/**
 * ============================================
 * SECTION: SERVICES - Formatação de Serviços
 * ============================================
 * Versão: 1.0.0
 *
 * Formata serviços, preços e informações de catálogo para o prompt.
 */

import { PromptSection, ServicesContext } from "../types";

const VERSION = "1.0.0";

/**
 * Gera a seção de serviços/produtos
 */
export function getServicesSection(services: ServicesContext): PromptSection {
  if (!services.services || services.services.length === 0) {
    return {
      id: "section_services",
      title: "SERVIÇOS",
      priority: 12,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## CATÁLOGO DE SERVIÇOS/PRODUTOS\n\n`;

  for (const service of services.services) {
    content += `### ${service.name}\n`;

    if (service.description) {
      content += `${service.description}\n`;
    }

    if (service.basePrice !== undefined) {
      content += `**Preço base:** R$ ${service.basePrice.toFixed(2)}\n`;
    }

    // Variáveis de preço
    if (service.variables && service.variables.length > 0) {
      content += `\n**Variações:**\n`;
      for (const variable of service.variables) {
        content += `- ${variable.name}:\n`;
        if (variable.options) {
          for (const option of variable.options) {
            const modifier = option.priceModifier > 0
              ? `+R$ ${option.priceModifier.toFixed(2)}`
              : option.priceModifier < 0
                ? `-R$ ${Math.abs(option.priceModifier).toFixed(2)}`
                : "mesmo preço";
            content += `  - ${option.name}: ${modifier}\n`;
          }
        }
      }
    }

    // Pricing tiers (faixas de quantidade)
    if (service.pricingTiers && service.pricingTiers.length > 0) {
      content += `\n**Preço por quantidade:**\n`;
      for (const tier of service.pricingTiers) {
        if (tier.maxQuantity) {
          content += `- ${tier.minQuantity}-${tier.maxQuantity} unidades: R$ ${tier.pricePerUnit.toFixed(2)} cada\n`;
        } else {
          content += `- ${tier.minQuantity}+ unidades: R$ ${tier.pricePerUnit.toFixed(2)} cada\n`;
        }
      }
    }

    content += `\n`;
  }

  content += `\n### Como apresentar serviços/produtos
- Fale com segurança, como quem conhece profundamente cada item
- Destaque os BENEFÍCIOS e o que o cliente ganha, não apenas o preço
- Quando o serviço tiver variações, pergunte a necessidade do cliente ANTES de listar tudo
- Se tiver faixas de preço por quantidade, informe a economia ao cliente
- Nunca invente preços, condições ou características que não estão listados acima
`;

  return {
    id: "section_services",
    title: "SERVIÇOS",
    priority: 12,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}

/**
 * Gera a seção de precificação avançada (zonas, combos, adicionais)
 */
export function getAdvancedPricingSection(services: ServicesContext): PromptSection {
  const { zones, combos, additionals } = services;

  const hasAdvancedPricing =
    (zones && zones.length > 0) ||
    (combos && combos.length > 0) ||
    (additionals && additionals.length > 0);

  if (!hasAdvancedPricing) {
    return {
      id: "section_advanced_pricing",
      title: "PRECIFICAÇÃO AVANÇADA",
      priority: 13,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## PRECIFICAÇÃO AVANÇADA\n\n`;

  // Zonas de atendimento
  if (zones && zones.length > 0) {
    content += `### Zonas de Atendimento\n`;
    content += `Taxas adicionais podem ser aplicadas baseadas na localização:\n\n`;

    for (const zone of zones) {
      content += `**${zone.name}**\n`;

      if (zone.isDefault) {
        content += `- (Zona padrão — sem taxa adicional)\n`;
      } else if (zone.requiresQuote) {
        content += `- Requer orçamento especial (não informar preço fechado)\n`;
      } else if (zone.pricingType === "FIXED") {
        content += `- Taxa fixa: +R$ ${zone.fixedFee?.toFixed(2) || "0.00"}\n`;
      } else if (zone.pricingType === "PERCENTAGE") {
        content += `- Taxa: +${zone.percentageFee || 0}%\n`;
      }

      if (zone.neighborhoods && zone.neighborhoods.length > 0) {
        content += `- Bairros incluídos: ${zone.neighborhoods.join(", ")}\n`;
      }

      // Exceções de taxa para esta zona
      if (zone.exceptions && zone.exceptions.length > 0) {
        content += `- **Exceções desta zona:**\n`;
        for (const exc of zone.exceptions) {
          if (exc.exceptionType === "NO_FEE") {
            const who = exc.category || (exc.serviceName ? exc.serviceName : "serviço específico");
            const qty = exc.minQuantity ? ` (a partir de ${exc.minQuantity} unidades)` : "";
            content += `  - ${who}${qty}: **sem taxa** nesta zona\n`;
          } else if (exc.exceptionType === "CUSTOM_FEE") {
            const who = exc.category || (exc.serviceName ? exc.serviceName : "serviço específico");
            const qty = exc.minQuantity ? ` (a partir de ${exc.minQuantity} unidades)` : "";
            content += `  - ${who}${qty}: taxa especial de R$ ${exc.customFee?.toFixed(2)}\n`;
          }
          if (exc.description) {
            content += `    *(${exc.description})*\n`;
          }
        }
      }

      content += `\n`;
    }

    content += `> Sempre verifique o bairro do cliente para aplicar a taxa correta antes de informar o preço final.\n\n`;
  }

  // Combos/Pacotes
  if (combos && combos.length > 0) {
    content += `### Combos e Pacotes\n`;
    content += `Preços especiais para combinações:\n\n`;

    for (const combo of combos) {
      content += `**${combo.name}**\n`;
      content += `- Preço fixo: R$ ${combo.fixedPrice?.toFixed(2)}\n`;
      if (combo.description) {
        content += `- ${combo.description}\n`;
      }
      if (combo.items && combo.items.length > 0) {
        const itemsDesc = combo.items
          .map((item: { serviceName?: string; quantity?: number; notes?: string }) =>
            `${item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}${item.serviceName || "serviço"}${item.notes ? ` (${item.notes})` : ""}`
          )
          .join(" + ");
        content += `- Inclui: ${itemsDesc}\n`;
      }
      content += `\n`;
    }
  }

  // Adicionais
  if (additionals && additionals.length > 0) {
    content += `### Serviços Adicionais\n`;
    content += `Extras que podem ser adicionados:\n\n`;

    for (const additional of additionals) {
      content += `- **${additional.name}:** +R$ ${additional.price?.toFixed(2)}\n`;
      if (additional.description) {
        content += `  ${additional.description}\n`;
      }
    }
  }

  // Instruções de venda inteligente para precificação avançada
  content += `\n\n### REGRAS DE VENDA INTELIGENTE (PRIORIDADE ALTA)

**Combos e Pacotes — Oferta Proativa:**
- Quando o cliente mencionar QUANTIDADE (ex: "quero 3 ar condicionados", "preciso de 2 limpezas") → verifique IMEDIATAMENTE se existe um combo/pacote que cubra essa necessidade
- Se existir combo compatível, **SEMPRE ofereça** mostrando a economia: "Temos o pacote X que inclui exatamente isso por R$ Y — você economiza R$ Z comparado ao valor individual!"
- Apresente o combo como uma OPORTUNIDADE, não como obrigação: "Uma ótima opção pra você seria..."
- Compare o preço do combo vs serviços avulsos para o cliente ver a vantagem

**Faixas de Quantidade — Desconto Automático:**
- Se o serviço tem preço por quantidade e o cliente pede múltiplas unidades → aplique o desconto correto e DESTAQUE a economia
- Ex: "Como são 6 unidades, o valor cai de R$ 400 pra R$ 350 cada — uma economia de R$ 300 no total!"

**Zonas — Transparência:**
- SEMPRE pergunte o bairro/região ANTES de fechar preço se houver zonas configuradas
- Aplique a taxa correta e explique de forma natural: "Para a região X, há uma taxa de deslocamento de R$ Y"
- Se a zona tem exceção (sem taxa, taxa especial), aplique e informe

**Adicionais — Sugestão Natural:**
- Ofereça adicionais que fazem sentido para o contexto, sem empurrar
- Ex: "Muitos clientes que fazem instalação também aproveitam pra adicionar X por apenas +R$ Y"

**Postura de Vendedor Experiente:**
- Fale com segurança e conhecimento sobre cada produto/serviço
- Destaque BENEFÍCIOS, não apenas características
- Use linguagem de oportunidade: "aproveitar", "condição especial", "melhor opção pra esse caso"
- Nunca invente preço, desconto ou condição que não esteja listada acima
`;

  return {
    id: "section_advanced_pricing",
    title: "PRECIFICAÇÃO AVANÇADA",
    priority: 13,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}
