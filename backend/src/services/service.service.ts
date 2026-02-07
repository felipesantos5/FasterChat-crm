import { prisma } from "../utils/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ServiceType, ZonePricingType } from "@prisma/client";
import { semanticServiceService } from "./semantic-service.service";
import ragService from "./rag.service";

/**
 * Formata todos os dados de serviços/produtos da empresa em texto para o RAG.
 * Inclui serviços, variações, preços, zonas, combos e adicionais.
 */
async function formatCompanyServicesForRAG(companyId: string): Promise<string> {
  const [services, zones, combos, additionals] = await Promise.all([
    prisma.service.findMany({
      where: { companyId, isActive: true },
      include: {
        variables: {
          include: { options: { orderBy: { order: "asc" } } },
          orderBy: { order: "asc" },
        },
        pricingTiers: { orderBy: { minQuantity: "asc" } },
      },
      orderBy: { order: "asc" },
    }),
    prisma.serviceZone.findMany({
      where: { companyId, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.serviceCombo.findMany({
      where: { companyId, isActive: true },
      include: {
        items: {
          include: { service: { select: { name: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
    prisma.serviceAdditional.findMany({
      where: { companyId, isActive: true },
      orderBy: { order: "asc" },
    }),
  ]);

  if (services.length === 0 && combos.length === 0) return "";

  const parts: string[] = [];

  // Serviços e Produtos
  const products = services.filter((s) => s.type === "PRODUCT");
  const svcs = services.filter((s) => s.type === "SERVICE");

  if (products.length > 0) {
    parts.push("PRODUTOS E PREÇOS:");
    for (const p of products) {
      const cat = p.category ? ` [${p.category}]` : "";
      parts.push(`- ${p.name}${cat}: R$ ${Number(p.basePrice).toFixed(2)}`);
      if (p.description) parts.push(`  Descrição: ${p.description}`);
      for (const v of p.variables) {
        parts.push(`  ${v.name}${v.isRequired ? " (obrigatório)" : ""}:`);
        for (const o of v.options) {
          const mod = Number(o.priceModifier);
          const final = Number(p.basePrice) + mod;
          parts.push(`    - ${o.name}: R$ ${final.toFixed(2)}${mod !== 0 ? ` (base ${mod > 0 ? "+" : ""}R$ ${mod.toFixed(2)})` : ""}`);
        }
      }
    }
    parts.push("");
  }

  if (svcs.length > 0) {
    parts.push("SERVIÇOS DISPONÍVEIS:");
    for (const s of svcs) {
      const cat = s.category ? ` [${s.category}]` : "";
      parts.push(`- ${s.name}${cat}`);
      if (s.description) parts.push(`  Descrição: ${s.description}`);
      if (s.duration) parts.push(`  Duração: ${s.duration} minutos`);

      if (s.pricingTiers.length > 0) {
        parts.push("  Preços por quantidade:");
        for (const t of s.pricingTiers) {
          const max = t.maxQuantity ? `${t.maxQuantity}` : "+";
          parts.push(`    - ${t.minQuantity} a ${max} unidades: R$ ${Number(t.pricePerUnit).toFixed(2)} cada`);
        }
      } else {
        parts.push(`  Preço base: R$ ${Number(s.basePrice).toFixed(2)}`);
      }

      for (const v of s.variables) {
        parts.push(`  ${v.name}${v.isRequired ? " (obrigatório)" : ""}:`);
        for (const o of v.options) {
          const mod = Number(o.priceModifier);
          const final = Number(s.basePrice) + mod;
          parts.push(`    - ${o.name}: R$ ${final.toFixed(2)}${mod !== 0 ? ` (base ${mod > 0 ? "+" : ""}R$ ${mod.toFixed(2)})` : ""}`);
        }
      }
    }
    parts.push("");
  }

  if (combos.length > 0) {
    parts.push("PACOTES E COMBOS (PREÇO FIXO):");
    for (const c of combos) {
      parts.push(`- ${c.name}: R$ ${Number(c.fixedPrice).toFixed(2)}`);
      if (c.description) parts.push(`  Descrição: ${c.description}`);
      if (c.items.length > 0) {
        parts.push("  Inclui:");
        for (const i of c.items) {
          parts.push(`    - ${i.quantity}x ${i.service.name}${i.notes ? ` (${i.notes})` : ""}`);
        }
      }
    }
    parts.push("");
  }

  if (zones.length > 0) {
    parts.push("ZONAS DE ATENDIMENTO E TAXAS:");
    for (const z of zones) {
      const def = z.isDefault ? " (padrão)" : "";
      const quote = z.requiresQuote ? " - requer orçamento especial" : "";
      parts.push(`- ${z.name}${def}${quote}`);
      if (z.description) parts.push(`  ${z.description}`);
      if (!z.isDefault && !z.requiresQuote) {
        if (z.pricingType === "FIXED") {
          parts.push(`  Taxa adicional: +R$ ${Number(z.priceModifier).toFixed(2)}`);
        } else {
          parts.push(`  Taxa adicional: +${Number(z.priceModifier)}%`);
        }
      }
      if (z.neighborhoods.length > 0) {
        parts.push(`  Bairros: ${z.neighborhoods.join(", ")}`);
      }
    }
    parts.push("");
  }

  if (additionals.length > 0) {
    parts.push("SERVIÇOS ADICIONAIS:");
    for (const a of additionals) {
      parts.push(`- ${a.name}: +R$ ${Number(a.price).toFixed(2)}`);
      if (a.description) parts.push(`  ${a.description}`);
      if (a.appliesToCategories.length > 0) {
        parts.push(`  Aplica-se a: ${a.appliesToCategories.join(", ")}`);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Sincroniza todos os serviços/produtos da empresa no RAG (em background)
 */
async function syncServicesToRAG(companyId: string): Promise<void> {
  try {
    const text = await formatCompanyServicesForRAG(companyId);

    if (!text || text.trim().length < 20) {
      await ragService.clearBySource(companyId, "services_structured");
      console.log(`[ServiceRAG] No services to index for company ${companyId}`);
      return;
    }

    await ragService.processAndStore(companyId, text, {
      source: "services_structured",
      type: "products_services",
    });

    console.log(`[ServiceRAG] Synced services to RAG for company ${companyId}`);
  } catch (error: any) {
    console.error(`[ServiceRAG] Error syncing services to RAG:`, error.message);
  }
}

interface CreateServiceDTO {
  name: string;
  description?: string;
  basePrice: number;
  type?: ServiceType;
  category?: string;
  isActive?: boolean;
}

interface UpdateServiceDTO {
  name?: string;
  description?: string;
  basePrice?: number;
  type?: ServiceType;
  category?: string;
  isActive?: boolean;
  order?: number;
}

interface CreateVariableDTO {
  name: string;
  description?: string;
  isRequired?: boolean;
  order?: number;
  options?: CreateOptionDTO[];
}

interface UpdateVariableDTO {
  name?: string;
  description?: string;
  isRequired?: boolean;
  order?: number;
}

interface CreateOptionDTO {
  name: string;
  priceModifier: number;
  order?: number;
}

interface UpdateOptionDTO {
  name?: string;
  priceModifier?: number;
  order?: number;
}

// ==================== ZONE DTOs ====================

interface CreateZoneDTO {
  name: string;
  description?: string;
  pricingType?: ZonePricingType;
  priceModifier?: number;
  neighborhoods?: string[];
  isDefault?: boolean;
  requiresQuote?: boolean;
  isActive?: boolean;
}

interface UpdateZoneDTO {
  name?: string;
  description?: string;
  pricingType?: ZonePricingType;
  priceModifier?: number;
  neighborhoods?: string[];
  isDefault?: boolean;
  requiresQuote?: boolean;
  isActive?: boolean;
  order?: number;
}

// ==================== PRICING TIER DTOs ====================

interface CreatePricingTierDTO {
  minQuantity: number;
  maxQuantity?: number | null;
  pricePerUnit: number;
  order?: number;
}

interface UpdatePricingTierDTO {
  minQuantity?: number;
  maxQuantity?: number | null;
  pricePerUnit?: number;
  order?: number;
}

// ==================== COMBO DTOs ====================

interface CreateComboDTO {
  name: string;
  description?: string;
  fixedPrice: number;
  category?: string;
  isActive?: boolean;
  items?: CreateComboItemDTO[];
}

interface UpdateComboDTO {
  name?: string;
  description?: string;
  fixedPrice?: number;
  category?: string;
  isActive?: boolean;
  order?: number;
}

interface CreateComboItemDTO {
  serviceId: string;
  quantity?: number;
  notes?: string;
  order?: number;
}

// ==================== ADDITIONAL DTOs ====================

interface CreateAdditionalDTO {
  name: string;
  description?: string;
  price: number;
  appliesToCategories?: string[];
  isActive?: boolean;
}

interface UpdateAdditionalDTO {
  name?: string;
  description?: string;
  price?: number;
  appliesToCategories?: string[];
  isActive?: boolean;
  order?: number;
}

// ==================== ZONE EXCEPTION DTOs ====================

interface CreateZoneExceptionDTO {
  zoneId: string;
  serviceId?: string;
  category?: string;
  minQuantity?: number;
  exceptionType: string;
  customFee?: number;
  description?: string;
  isActive?: boolean;
}

export const serviceService = {
  // ==================== SERVICES ====================

  async listServices(companyId: string) {
    return prisma.service.findMany({
      where: { companyId },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });
  },

  async getService(id: string, companyId: string) {
    return prisma.service.findFirst({
      where: { id, companyId },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async createService(companyId: string, data: CreateServiceDTO) {
    const lastService = await prisma.service.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
    });

    const service = await prisma.service.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        basePrice: new Decimal(data.basePrice),
        type: data.type ?? "SERVICE",
        category: data.category,
        isActive: data.isActive ?? true,
        order: (lastService?.order ?? -1) + 1,
      },
      include: {
        variables: {
          include: {
            options: true,
          },
        },
      },
    });

    // Gera embedding semântico para o novo serviço (async, não bloqueia)
    semanticServiceService.generateServiceEmbedding(service.id).catch((error) => {
      console.error(`[ServiceService] Erro ao gerar embedding para serviço ${service.id}:`, error);
    });

    // Sincroniza todos os serviços no RAG (async, não bloqueia)
    syncServicesToRAG(companyId).catch(() => {});

    return service;
  },

  async updateService(id: string, companyId: string, data: UpdateServiceDTO) {
    const existingService = await prisma.service.findFirst({
      where: { id, companyId },
    });

    if (!existingService) {
      throw new Error("Serviço não encontrado");
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice !== undefined ? new Decimal(data.basePrice) : undefined,
        type: data.type,
        category: data.category,
        isActive: data.isActive,
        order: data.order,
      },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    // Atualiza embedding semântico se campos relevantes mudaram (async, não bloqueia)
    if (data.name || data.description || data.category) {
      semanticServiceService.generateServiceEmbedding(id).catch((error) => {
        console.error(`[ServiceService] Erro ao atualizar embedding do serviço ${id}:`, error);
      });
    }

    // Sincroniza todos os serviços no RAG (async, não bloqueia)
    syncServicesToRAG(companyId).catch(() => {});

    return updatedService;
  },

  async deleteService(id: string, companyId: string) {
    const service = await prisma.service.findFirst({
      where: { id, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    const result = await prisma.service.delete({
      where: { id },
    });

    // Sincroniza todos os serviços no RAG (async, não bloqueia)
    syncServicesToRAG(companyId).catch(() => {});

    return result;
  },

  async reorderServices(companyId: string, serviceIds: string[]) {
    const updates = serviceIds.map((id, index) =>
      prisma.service.updateMany({
        where: { id, companyId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
    return this.listServices(companyId);
  },

  // ==================== VARIABLES ====================

  async createVariable(serviceId: string, companyId: string, data: CreateVariableDTO) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    const lastVariable = await prisma.serviceVariable.findFirst({
      where: { serviceId },
      orderBy: { order: "desc" },
    });

    const variable = await prisma.serviceVariable.create({
      data: {
        serviceId,
        name: data.name,
        description: data.description,
        isRequired: data.isRequired ?? true,
        order: data.order ?? (lastVariable?.order ?? -1) + 1,
      },
    });

    // Criar opções se fornecidas
    if (data.options && data.options.length > 0) {
      await prisma.serviceVariableOption.createMany({
        data: data.options.map((opt, index) => ({
          variableId: variable.id,
          name: opt.name,
          priceModifier: new Decimal(opt.priceModifier),
          order: opt.order ?? index,
        })),
      });
    }

    return prisma.serviceVariable.findUnique({
      where: { id: variable.id },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async updateVariable(variableId: string, companyId: string, data: UpdateVariableDTO) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    return prisma.serviceVariable.update({
      where: { id: variableId },
      data: {
        name: data.name,
        description: data.description,
        isRequired: data.isRequired,
        order: data.order,
      },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async deleteVariable(variableId: string, companyId: string) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    return prisma.serviceVariable.delete({
      where: { id: variableId },
    });
  },

  async reorderVariables(serviceId: string, companyId: string, variableIds: string[]) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    const updates = variableIds.map((id, index) =>
      prisma.serviceVariable.updateMany({
        where: { id, serviceId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
  },

  // ==================== OPTIONS ====================

  async createOption(variableId: string, companyId: string, data: CreateOptionDTO) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    const lastOption = await prisma.serviceVariableOption.findFirst({
      where: { variableId },
      orderBy: { order: "desc" },
    });

    return prisma.serviceVariableOption.create({
      data: {
        variableId,
        name: data.name,
        priceModifier: new Decimal(data.priceModifier),
        order: data.order ?? (lastOption?.order ?? -1) + 1,
      },
    });
  },

  async updateOption(optionId: string, companyId: string, data: UpdateOptionDTO) {
    const option = await prisma.serviceVariableOption.findFirst({
      where: {
        id: optionId,
        variable: {
          service: { companyId },
        },
      },
    });

    if (!option) {
      throw new Error("Opção não encontrada");
    }

    return prisma.serviceVariableOption.update({
      where: { id: optionId },
      data: {
        name: data.name,
        priceModifier: data.priceModifier !== undefined ? new Decimal(data.priceModifier) : undefined,
        order: data.order,
      },
    });
  },

  async deleteOption(optionId: string, companyId: string) {
    const option = await prisma.serviceVariableOption.findFirst({
      where: {
        id: optionId,
        variable: {
          service: { companyId },
        },
      },
    });

    if (!option) {
      throw new Error("Opção não encontrada");
    }

    return prisma.serviceVariableOption.delete({
      where: { id: optionId },
    });
  },

  async reorderOptions(variableId: string, companyId: string, optionIds: string[]) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    const updates = optionIds.map((id, index) =>
      prisma.serviceVariableOption.updateMany({
        where: { id, variableId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
  },

  // ==================== BULK OPERATIONS ====================

  async saveServiceComplete(
    companyId: string,
    serviceData: {
      id?: string;
      name: string;
      description?: string;
      basePrice: number;
      type?: ServiceType;
      category?: string;
      duration?: number; // Duração em minutos (padrão: 60)
      isActive?: boolean;
      variables: {
        id?: string;
        name: string;
        description?: string;
        isRequired?: boolean;
        options: {
          id?: string;
          name: string;
          priceModifier: number;
        }[];
      }[];
    }
  ) {
    // Se tem ID, é update, senão é create
    if (serviceData.id) {
      // Verificar se pertence à empresa
      const existing = await prisma.service.findFirst({
        where: { id: serviceData.id, companyId },
      });

      if (!existing) {
        throw new Error("Serviço não encontrado");
      }

      // Update service
      const service = await prisma.service.update({
        where: { id: serviceData.id },
        data: {
          name: serviceData.name,
          description: serviceData.description,
          basePrice: new Decimal(serviceData.basePrice),
          type: serviceData.type ?? "SERVICE",
          category: serviceData.category,
          duration: serviceData.duration ?? 60,
          isActive: serviceData.isActive ?? true,
        },
      });

      // Deletar variáveis e opções antigas
      await prisma.serviceVariable.deleteMany({
        where: { serviceId: service.id },
      });

      // Recriar variáveis e opções
      for (let vIndex = 0; vIndex < serviceData.variables.length; vIndex++) {
        const varData = serviceData.variables[vIndex];
        const variable = await prisma.serviceVariable.create({
          data: {
            serviceId: service.id,
            name: varData.name,
            description: varData.description,
            isRequired: varData.isRequired ?? true,
            order: vIndex,
          },
        });

        if (varData.options.length > 0) {
          await prisma.serviceVariableOption.createMany({
            data: varData.options.map((opt, oIndex) => ({
              variableId: variable.id,
              name: opt.name,
              priceModifier: new Decimal(opt.priceModifier),
              order: oIndex,
            })),
          });
        }
      }

      // Atualiza embedding semântico (async, não bloqueia)
      semanticServiceService.generateServiceEmbedding(service.id).catch((error) => {
        console.error(`[ServiceService] Erro ao atualizar embedding do serviço ${service.id}:`, error);
      });

      // Sincroniza todos os serviços no RAG (async, não bloqueia)
      syncServicesToRAG(companyId).catch(() => {});

      return this.getService(service.id, companyId);
    } else {
      // Create new service
      const lastService = await prisma.service.findFirst({
        where: { companyId },
        orderBy: { order: "desc" },
      });

      const service = await prisma.service.create({
        data: {
          companyId,
          name: serviceData.name,
          description: serviceData.description,
          basePrice: new Decimal(serviceData.basePrice),
          type: serviceData.type ?? "SERVICE",
          category: serviceData.category,
          duration: serviceData.duration ?? 60,
          isActive: serviceData.isActive ?? true,
          order: (lastService?.order ?? -1) + 1,
        },
      });

      // Criar variáveis e opções
      for (let vIndex = 0; vIndex < serviceData.variables.length; vIndex++) {
        const varData = serviceData.variables[vIndex];
        const variable = await prisma.serviceVariable.create({
          data: {
            serviceId: service.id,
            name: varData.name,
            description: varData.description,
            isRequired: varData.isRequired ?? true,
            order: vIndex,
          },
        });

        if (varData.options.length > 0) {
          await prisma.serviceVariableOption.createMany({
            data: varData.options.map((opt, oIndex) => ({
              variableId: variable.id,
              name: opt.name,
              priceModifier: new Decimal(opt.priceModifier),
              order: oIndex,
            })),
          });
        }
      }

      // Gera embedding semântico para o novo serviço (async, não bloqueia)
      semanticServiceService.generateServiceEmbedding(service.id).catch((error) => {
        console.error(`[ServiceService] Erro ao gerar embedding do serviço ${service.id}:`, error);
      });

      // Sincroniza todos os serviços no RAG (async, não bloqueia)
      syncServicesToRAG(companyId).catch(() => {});

      return this.getService(service.id, companyId);
    }
  },

  // ==================== GET SERVICES FOR AI ====================

  async getServicesForAI(companyId: string) {
    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        pricingTiers: {
          orderBy: { minQuantity: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    // Formatar para a IA entender facilmente
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      basePrice: Number(service.basePrice),
      type: service.type,
      category: service.category,
      duration: service.duration ?? 60, // Duração em minutos (padrão: 60)
      variables: service.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        description: variable.description,
        isRequired: variable.isRequired,
        options: variable.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceModifier: Number(option.priceModifier),
        })),
      })),
      // Faixas de preço por quantidade (se existirem)
      pricingTiers: service.pricingTiers.length > 0
        ? service.pricingTiers.map((tier) => ({
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            pricePerUnit: Number(tier.pricePerUnit),
          }))
        : null,
    }));
  },

  // ==================== SERVICE ZONES ====================

  async listZones(companyId: string) {
    return prisma.serviceZone.findMany({
      where: { companyId },
      orderBy: { order: "asc" },
    });
  },

  async getZone(id: string, companyId: string) {
    return prisma.serviceZone.findFirst({
      where: { id, companyId },
    });
  },

  async createZone(companyId: string, data: CreateZoneDTO) {
    // Se marcando como default, remover default dos outros
    if (data.isDefault) {
      await prisma.serviceZone.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const lastZone = await prisma.serviceZone.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
    });

    const zone = await prisma.serviceZone.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        pricingType: data.pricingType ?? "FIXED",
        priceModifier: new Decimal(data.priceModifier ?? 0),
        neighborhoods: data.neighborhoods ?? [],
        isDefault: data.isDefault ?? false,
        requiresQuote: data.requiresQuote ?? false,
        isActive: data.isActive ?? true,
        order: (lastZone?.order ?? -1) + 1,
      },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return zone;
  },

  async updateZone(id: string, companyId: string, data: UpdateZoneDTO) {
    const zone = await prisma.serviceZone.findFirst({
      where: { id, companyId },
    });

    if (!zone) {
      throw new Error("Zona não encontrada");
    }

    // Se marcando como default, remover default dos outros
    if (data.isDefault) {
      await prisma.serviceZone.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.serviceZone.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        pricingType: data.pricingType,
        priceModifier: data.priceModifier !== undefined ? new Decimal(data.priceModifier) : undefined,
        neighborhoods: data.neighborhoods,
        isDefault: data.isDefault,
        requiresQuote: data.requiresQuote,
        isActive: data.isActive,
        order: data.order,
      },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return updated;
  },

  async deleteZone(id: string, companyId: string) {
    const zone = await prisma.serviceZone.findFirst({
      where: { id, companyId },
    });

    if (!zone) {
      throw new Error("Zona não encontrada");
    }

    const result = await prisma.serviceZone.delete({
      where: { id },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return result;
  },

  async findZoneByNeighborhood(companyId: string, neighborhood: string) {
    const normalizedNeighborhood = neighborhood.toLowerCase().trim();

    const zones = await prisma.serviceZone.findMany({
      where: { companyId, isActive: true },
      orderBy: { order: "asc" },
    });

    // Procura zona que contenha o bairro
    for (const zone of zones) {
      const normalizedNeighborhoods = zone.neighborhoods.map((n) => n.toLowerCase().trim());
      if (normalizedNeighborhoods.includes(normalizedNeighborhood)) {
        return zone;
      }
    }

    // Retorna zona default se existir
    return zones.find((z) => z.isDefault) || null;
  },

  // ==================== PRICING TIERS ====================

  async listPricingTiers(serviceId: string, companyId: string) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    return prisma.servicePricingTier.findMany({
      where: { serviceId },
      orderBy: { minQuantity: "asc" },
    });
  },

  async createPricingTier(serviceId: string, companyId: string, data: CreatePricingTierDTO) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    return prisma.servicePricingTier.create({
      data: {
        serviceId,
        minQuantity: data.minQuantity,
        maxQuantity: data.maxQuantity,
        pricePerUnit: new Decimal(data.pricePerUnit),
        order: data.order ?? 0,
      },
    });
  },

  async updatePricingTier(tierId: string, companyId: string, data: UpdatePricingTierDTO) {
    const tier = await prisma.servicePricingTier.findFirst({
      where: {
        id: tierId,
        service: { companyId },
      },
    });

    if (!tier) {
      throw new Error("Faixa de preço não encontrada");
    }

    return prisma.servicePricingTier.update({
      where: { id: tierId },
      data: {
        minQuantity: data.minQuantity,
        maxQuantity: data.maxQuantity,
        pricePerUnit: data.pricePerUnit !== undefined ? new Decimal(data.pricePerUnit) : undefined,
        order: data.order,
      },
    });
  },

  async deletePricingTier(tierId: string, companyId: string) {
    const tier = await prisma.servicePricingTier.findFirst({
      where: {
        id: tierId,
        service: { companyId },
      },
    });

    if (!tier) {
      throw new Error("Faixa de preço não encontrada");
    }

    return prisma.servicePricingTier.delete({
      where: { id: tierId },
    });
  },

  async setPricingTiers(serviceId: string, companyId: string, tiers: CreatePricingTierDTO[]) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    // Deletar todas as faixas existentes
    await prisma.servicePricingTier.deleteMany({
      where: { serviceId },
    });

    // Criar novas faixas
    if (tiers.length > 0) {
      await prisma.servicePricingTier.createMany({
        data: tiers.map((tier, index) => ({
          serviceId,
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          pricePerUnit: new Decimal(tier.pricePerUnit),
          order: tier.order ?? index,
        })),
      });
    }

    return this.listPricingTiers(serviceId, companyId);
  },

  calculatePriceByQuantity(pricingTiers: { minQuantity: number; maxQuantity: number | null; pricePerUnit: number }[], quantity: number): number {
    // Ordenar por minQuantity
    const sortedTiers = [...pricingTiers].sort((a, b) => a.minQuantity - b.minQuantity);

    for (const tier of sortedTiers) {
      const min = tier.minQuantity;
      const max = tier.maxQuantity ?? Infinity;

      if (quantity >= min && quantity <= max) {
        return tier.pricePerUnit * quantity;
      }
    }

    // Se não encontrou faixa, usar o último tier
    if (sortedTiers.length > 0) {
      return sortedTiers[sortedTiers.length - 1].pricePerUnit * quantity;
    }

    return 0;
  },

  // ==================== SERVICE COMBOS ====================

  async listCombos(companyId: string) {
    return prisma.serviceCombo.findMany({
      where: { companyId },
      include: {
        items: {
          include: {
            service: {
              select: { id: true, name: true, category: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });
  },

  async getCombo(id: string, companyId: string) {
    return prisma.serviceCombo.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            service: {
              select: { id: true, name: true, category: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async createCombo(companyId: string, data: CreateComboDTO) {
    const lastCombo = await prisma.serviceCombo.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
    });

    const combo = await prisma.serviceCombo.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        fixedPrice: new Decimal(data.fixedPrice),
        category: data.category,
        isActive: data.isActive ?? true,
        order: (lastCombo?.order ?? -1) + 1,
      },
    });

    // Criar itens se fornecidos
    if (data.items && data.items.length > 0) {
      await prisma.serviceComboItem.createMany({
        data: data.items.map((item, index) => ({
          comboId: combo.id,
          serviceId: item.serviceId,
          quantity: item.quantity ?? 1,
          notes: item.notes,
          order: item.order ?? index,
        })),
      });
    }

    syncServicesToRAG(companyId).catch(() => {});
    return this.getCombo(combo.id, companyId);
  },

  async updateCombo(id: string, companyId: string, data: UpdateComboDTO) {
    const combo = await prisma.serviceCombo.findFirst({
      where: { id, companyId },
    });

    if (!combo) {
      throw new Error("Combo não encontrado");
    }

    return prisma.serviceCombo.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        fixedPrice: data.fixedPrice !== undefined ? new Decimal(data.fixedPrice) : undefined,
        category: data.category,
        isActive: data.isActive,
        order: data.order,
      },
      include: {
        items: {
          include: {
            service: {
              select: { id: true, name: true, category: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async deleteCombo(id: string, companyId: string) {
    const combo = await prisma.serviceCombo.findFirst({
      where: { id, companyId },
    });

    if (!combo) {
      throw new Error("Combo não encontrado");
    }

    const result = await prisma.serviceCombo.delete({
      where: { id },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return result;
  },

  async setComboItems(comboId: string, companyId: string, items: CreateComboItemDTO[]) {
    const combo = await prisma.serviceCombo.findFirst({
      where: { id: comboId, companyId },
    });

    if (!combo) {
      throw new Error("Combo não encontrado");
    }

    // Deletar itens existentes
    await prisma.serviceComboItem.deleteMany({
      where: { comboId },
    });

    // Criar novos itens
    if (items.length > 0) {
      await prisma.serviceComboItem.createMany({
        data: items.map((item, index) => ({
          comboId,
          serviceId: item.serviceId,
          quantity: item.quantity ?? 1,
          notes: item.notes,
          order: item.order ?? index,
        })),
      });
    }

    return this.getCombo(comboId, companyId);
  },

  // ==================== SERVICE ADDITIONALS ====================

  async listAdditionals(companyId: string) {
    return prisma.serviceAdditional.findMany({
      where: { companyId },
      orderBy: { order: "asc" },
    });
  },

  async getAdditional(id: string, companyId: string) {
    return prisma.serviceAdditional.findFirst({
      where: { id, companyId },
    });
  },

  async createAdditional(companyId: string, data: CreateAdditionalDTO) {
    const lastAdditional = await prisma.serviceAdditional.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
    });

    const additional = await prisma.serviceAdditional.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        price: new Decimal(data.price),
        appliesToCategories: data.appliesToCategories ?? [],
        isActive: data.isActive ?? true,
        order: (lastAdditional?.order ?? -1) + 1,
      },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return additional;
  },

  async updateAdditional(id: string, companyId: string, data: UpdateAdditionalDTO) {
    const additional = await prisma.serviceAdditional.findFirst({
      where: { id, companyId },
    });

    if (!additional) {
      throw new Error("Adicional não encontrado");
    }

    const updated = await prisma.serviceAdditional.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price !== undefined ? new Decimal(data.price) : undefined,
        appliesToCategories: data.appliesToCategories,
        isActive: data.isActive,
        order: data.order,
      },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return updated;
  },

  async deleteAdditional(id: string, companyId: string) {
    const additional = await prisma.serviceAdditional.findFirst({
      where: { id, companyId },
    });

    if (!additional) {
      throw new Error("Adicional não encontrado");
    }

    const result = await prisma.serviceAdditional.delete({
      where: { id },
    });

    syncServicesToRAG(companyId).catch(() => {});
    return result;
  },

  // ==================== ZONE EXCEPTIONS ====================

  async listZoneExceptions(companyId: string) {
    return prisma.serviceZoneException.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });
  },

  async createZoneException(companyId: string, data: CreateZoneExceptionDTO) {
    return prisma.serviceZoneException.create({
      data: {
        companyId,
        zoneId: data.zoneId,
        serviceId: data.serviceId,
        category: data.category,
        minQuantity: data.minQuantity,
        exceptionType: data.exceptionType,
        customFee: data.customFee !== undefined ? new Decimal(data.customFee) : undefined,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  },

  async deleteZoneException(id: string, companyId: string) {
    const exception = await prisma.serviceZoneException.findFirst({
      where: { id, companyId },
    });

    if (!exception) {
      throw new Error("Exceção não encontrada");
    }

    return prisma.serviceZoneException.delete({
      where: { id },
    });
  },

  async checkZoneException(
    companyId: string,
    zoneId: string,
    serviceId?: string,
    category?: string,
    quantity?: number
  ): Promise<{ hasException: boolean; exceptionType?: string; customFee?: number }> {
    const exceptions = await prisma.serviceZoneException.findMany({
      where: {
        companyId,
        zoneId,
        isActive: true,
        OR: [
          { serviceId: serviceId || undefined },
          { category: category || undefined },
        ],
      },
    });

    for (const exception of exceptions) {
      // Verificar se a quantidade atende ao mínimo
      if (exception.minQuantity && quantity && quantity < exception.minQuantity) {
        continue;
      }

      // Verificar match de serviço ou categoria
      if (exception.serviceId && exception.serviceId === serviceId) {
        return {
          hasException: true,
          exceptionType: exception.exceptionType,
          customFee: exception.customFee ? Number(exception.customFee) : undefined,
        };
      }

      if (exception.category && exception.category === category) {
        return {
          hasException: true,
          exceptionType: exception.exceptionType,
          customFee: exception.customFee ? Number(exception.customFee) : undefined,
        };
      }
    }

    return { hasException: false };
  },

  // ==================== GET COMPLETE PRICING DATA FOR AI ====================

  async getCompletePricingForAI(companyId: string) {
    // Buscar todos os dados de precificação
    const [services, zones, combos, additionals, exceptions] = await Promise.all([
      this.getServicesForAI(companyId),
      prisma.serviceZone.findMany({
        where: { companyId, isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.serviceCombo.findMany({
        where: { companyId, isActive: true },
        include: {
          items: {
            include: {
              service: {
                select: { id: true, name: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      }),
      prisma.serviceAdditional.findMany({
        where: { companyId, isActive: true },
        orderBy: { order: "asc" },
      }),
      prisma.serviceZoneException.findMany({
        where: { companyId, isActive: true },
      }),
    ]);

    return {
      services,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        description: z.description,
        pricingType: z.pricingType,
        priceModifier: Number(z.priceModifier),
        neighborhoods: z.neighborhoods,
        isDefault: z.isDefault,
        requiresQuote: z.requiresQuote,
      })),
      combos: combos.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        fixedPrice: Number(c.fixedPrice),
        category: c.category,
        items: c.items.map((i) => ({
          serviceName: i.service.name,
          quantity: i.quantity,
          notes: i.notes,
        })),
      })),
      additionals: additionals.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        price: Number(a.price),
        appliesToCategories: a.appliesToCategories,
      })),
      exceptions: exceptions.map((e) => ({
        zoneId: e.zoneId,
        serviceId: e.serviceId,
        category: e.category,
        minQuantity: e.minQuantity,
        exceptionType: e.exceptionType,
        customFee: e.customFee ? Number(e.customFee) : null,
        description: e.description,
      })),
    };
  },
};
