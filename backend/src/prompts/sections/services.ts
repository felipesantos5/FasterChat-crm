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

      if (zone.pricingType === "FIXED") {
        content += `- Taxa fixa: +R$ ${zone.fixedFee?.toFixed(2) || "0.00"}\n`;
      } else if (zone.pricingType === "PERCENTAGE") {
        content += `- Taxa: +${zone.percentageFee || 0}%\n`;
      }

      if (zone.neighborhoods && zone.neighborhoods.length > 0) {
        content += `- Bairros: ${zone.neighborhoods.join(", ")}\n`;
      }

      if (zone.isDefault) {
        content += `- (Zona padrão)\n`;
      }

      content += `\n`;
    }
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

  return {
    id: "section_advanced_pricing",
    title: "PRECIFICAÇÃO AVANÇADA",
    priority: 13,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}
