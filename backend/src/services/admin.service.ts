import { prisma } from "../utils/prisma";
import { ZonePricingType } from "@prisma/client";

// Credenciais do admin - senha via variável de ambiente
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: process.env.ROOT_PASSWORD || "admin",
};

export const adminService = {
  // Verifica as credenciais do admin
  validateCredentials(username: string, password: string): boolean {
    return (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    );
  },

  // Lista todas as empresas com estatísticas
  async listCompanies() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const companies = await prisma.company.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        customers: {
          select: {
            id: true,
          },
        },
        whatsappInstances: {
          select: {
            id: true,
            messages: {
              where: {
                direction: "INBOUND",
                timestamp: {
                  gte: thirtyDaysAgo,
                },
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Formatar os dados para retornar
    return companies.map((company) => {
      // Encontra o admin (dono) da empresa
      const owner = company.users.find((user) => user.role === "ADMIN");

      // Conta o total de colaboradores (excluindo o dono)
      const collaboratorsCount = company.users.filter(
        (user) => user.role !== "ADMIN"
      ).length;

      // Conta as mensagens recebidas nos últimos 30 dias
      const messagesLast30Days = company.whatsappInstances.reduce(
        (total, instance) => total + instance.messages.length,
        0
      );

      return {
        id: company.id,
        name: company.name,
        ownerEmail: owner?.email || "N/A",
        ownerName: owner?.name || "N/A",
        collaboratorsCount,
        customersCount: company.customers.length,
        messagesLast30Days,
        createdAt: company.createdAt,
      };
    });
  },

  // Busca estatísticas gerais
  async getStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalCompanies, totalUsers, totalMessages] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.message.count({
        where: {
          direction: "INBOUND",
          timestamp: {
            gte: thirtyDaysAgo,
          },
        },
      }),
    ]);

    return {
      totalCompanies,
      totalUsers,
      totalMessagesLast30Days: totalMessages,
    };
  },

  // Seed de dados HVAC para cliente específico
  async seedHvacData(companyId: string) {
    // Verifica se a empresa existe
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Empresa com ID ${companyId} não encontrada`);
    }

    const results = {
      services: 0,
      pricingTiers: 0,
      zones: 0,
      combos: 0,
      additionals: 0,
      exceptions: 0,
    };

    // ========================================
    // 1. CRIAR SERVIÇOS
    // ========================================
    const services = [
      {
        name: "Instalação Split 9K/12K",
        description: "Instalação de ar condicionado split 9.000 ou 12.000 BTUs. Inclui infra pronta ou furo/furo.",
        basePrice: 795.0,
        category: "Instalação",
        pricingTiers: [],
      },
      {
        name: "Instalação Split 18K",
        description: "Instalação de ar condicionado split 18.000 BTUs. Inclui infra pronta ou furo/furo.",
        basePrice: 855.0,
        category: "Instalação",
        pricingTiers: [],
      },
      {
        name: "Instalação Split 24K",
        description: "Instalação de ar condicionado split 24.000 BTUs. Inclui infra pronta ou furo/furo.",
        basePrice: 995.0,
        category: "Instalação",
        pricingTiers: [],
      },
      {
        name: "Desinstalação Split até 24K",
        description: "Desinstalação de ar condicionado split até 24.000 BTUs.",
        basePrice: 275.0,
        category: "Desinstalação",
        pricingTiers: [
          { minQuantity: 1, maxQuantity: 1, pricePerUnit: 275.0 },
          { minQuantity: 2, maxQuantity: 4, pricePerUnit: 250.0 },
          { minQuantity: 5, maxQuantity: null, pricePerUnit: 200.0 },
        ],
      },
      {
        name: "Limpeza Split",
        description: "Limpeza completa de ar condicionado split (evaporadora e condensadora).",
        basePrice: 250.0,
        category: "Limpeza",
        pricingTiers: [
          { minQuantity: 1, maxQuantity: 1, pricePerUnit: 250.0 },
          { minQuantity: 2, maxQuantity: 2, pricePerUnit: 225.0 },
          { minQuantity: 3, maxQuantity: 3, pricePerUnit: 198.33 },
          { minQuantity: 4, maxQuantity: 4, pricePerUnit: 198.75 },
          { minQuantity: 5, maxQuantity: null, pricePerUnit: 190.0 },
        ],
      },
      {
        name: "Visita Técnica",
        description: "Visita técnica para diagnóstico e avaliação do equipamento.",
        basePrice: 240.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Mão de Obra Corretiva Básica",
        description: "Mão de obra para corretiva básica (troca de placa, motor, ajustes técnicos). Peças não inclusas.",
        basePrice: 320.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Carga de Gás Split 9K/12K",
        description: "Carga de gás refrigerante para split 9.000 a 12.000 BTUs.",
        basePrice: 395.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Carga de Gás Split 18K/24K",
        description: "Carga de gás refrigerante para split 18.000 a 24.000 BTUs. Inclui aperto na porca, solda simples, correção de flanges.",
        basePrice: 495.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Correção Vazamento + Carga Gás 9K/12K",
        description: "Correção de vazamento com carga de gás para split 9K a 12K sem nitrogênio (aperto na porca, solda simples, flange).",
        basePrice: 595.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Correção Vazamento + Carga Gás 18K/24K",
        description: "Correção de vazamento com carga de gás para split 18K a 24K sem nitrogênio (aperto na porca, solda simples, correção flanges).",
        basePrice: 695.0,
        category: "Manutenção",
        pricingTiers: [],
      },
      {
        name: "Placa Universal",
        description: "Instalação de placa universal (peças + mão de obra inclusa).",
        basePrice: 695.0,
        category: "Manutenção",
        pricingTiers: [],
      },
    ];

    const createdServices: { [key: string]: string } = {};

    for (const service of services) {
      const created = await prisma.service.upsert({
        where: {
          companyId_name: {
            companyId,
            name: service.name,
          },
        },
        update: {
          description: service.description,
          basePrice: service.basePrice,
          category: service.category,
        },
        create: {
          companyId,
          name: service.name,
          description: service.description,
          basePrice: service.basePrice,
          category: service.category,
          isActive: true,
        },
      });

      createdServices[service.name] = created.id;
      results.services++;

      if (service.pricingTiers.length > 0) {
        await prisma.servicePricingTier.deleteMany({
          where: { serviceId: created.id },
        });

        for (const tier of service.pricingTiers) {
          await prisma.servicePricingTier.create({
            data: {
              serviceId: created.id,
              minQuantity: tier.minQuantity,
              maxQuantity: tier.maxQuantity,
              pricePerUnit: tier.pricePerUnit,
            },
          });
          results.pricingTiers++;
        }
      }
    }

    // ========================================
    // 2. CRIAR ZONAS
    // ========================================
    const zones = [
      {
        name: "Continente",
        description: "São José, Biguaçu, Parte Continental de Florianópolis, Palhoça até Guarda do Cubatão",
        pricingType: ZonePricingType.FIXED,
        priceModifier: 0,
        isDefault: true,
        requiresQuote: false,
        neighborhoods: [
          "São José", "Kobrasol", "Campinas", "Barreiros", "Forquilhinhas", "Ipiranga", "Serraria",
          "Praia Comprida", "Fazenda Santo Antônio", "Roçado", "Bela Vista",
          "Biguaçu", "Fundos", "Vendaval",
          "Balneário do Estreito", "Capoeiras", "Coqueiros", "Estreito", "Abraão",
          "Bom Abrigo", "Itaguaçu", "Canto", "Coloninha", "Jardim Atlântico",
          "Palhoça", "Ponte do Imaruim", "Aririú", "Barra do Aririú", "Guarda do Cubatão",
          "Pagani", "Passa Vinte", "São Sebastião",
        ],
      },
      {
        name: "Ilha",
        description: "Parte da Ilha de Florianópolis com adicional de R$ 55,00",
        pricingType: ZonePricingType.FIXED,
        priceModifier: 55.0,
        isDefault: false,
        requiresQuote: false,
        neighborhoods: [
          "Agronômica", "Centro", "Saco dos Limões", "Trindade", "Pantanal",
          "Santa Mônica", "João Paulo", "Monte Verde",
          "Itacorubi", "Córrego Grande", "Carvoeira", "Joaquina",
          "Lagoa da Conceição", "Parque São Jorge",
          "Campeche", "Carianos", "Costeira do Pirajubaé", "Rio Tavares", "Morro das Pedras",
          "Santo Antônio de Lisboa", "Cacupé",
        ],
      },
      {
        name: "Extremos da Ilha",
        description: "Bairros nos extremos da Ilha - atendimento somente com orçamento especial",
        pricingType: ZonePricingType.FIXED,
        priceModifier: 0,
        isDefault: false,
        requiresQuote: true,
        neighborhoods: [
          "Cachoeira do Bom Jesus", "Canasvieiras", "Ingleses", "Jurerê",
          "Jurerê Internacional", "Ponta das Canas", "Praia Brava",
          "São João do Rio Vermelho", "Vargem Grande", "Vargem Pequena",
          "Ratones", "Rio Vermelho", "Sambaqui", "Barra da Lagoa",
          "Canto da Lagoa", "Praia Mole", "Pantano do Sul", "Ribeirão da Ilha",
          "Tapera", "Açores", "Caeira da Barra do Sul", "Solidão",
        ],
      },
    ];

    const createdZones: { [key: string]: string } = {};

    for (const zone of zones) {
      const created = await prisma.serviceZone.upsert({
        where: {
          companyId_name: {
            companyId,
            name: zone.name,
          },
        },
        update: {
          description: zone.description,
          pricingType: zone.pricingType,
          priceModifier: zone.priceModifier,
          isDefault: zone.isDefault,
          requiresQuote: zone.requiresQuote,
          neighborhoods: zone.neighborhoods,
        },
        create: {
          companyId,
          name: zone.name,
          description: zone.description,
          pricingType: zone.pricingType,
          priceModifier: zone.priceModifier,
          isDefault: zone.isDefault,
          requiresQuote: zone.requiresQuote,
          neighborhoods: zone.neighborhoods,
        },
      });

      createdZones[zone.name] = created.id;
      results.zones++;
    }

    // ========================================
    // 3. CRIAR COMBOS
    // ========================================
    const combos = [
      {
        name: "2x Split 9K/12K",
        description: "Instalação de 2 splits de 9K ou 12K",
        fixedPrice: 1495.0,
        items: [{ serviceName: "Instalação Split 9K/12K", quantity: 2 }],
      },
      {
        name: "3x Split 9K/12K",
        description: "Instalação de 3 splits de 9K ou 12K",
        fixedPrice: 1898.0,
        items: [{ serviceName: "Instalação Split 9K/12K", quantity: 3 }],
      },
      {
        name: "2x Split 18K",
        description: "Instalação de 2 splits de 18K",
        fixedPrice: 1590.0,
        items: [{ serviceName: "Instalação Split 18K", quantity: 2 }],
      },
      {
        name: "1x Split 9K/12K + 1x Split 18K",
        description: "Instalação de 1 split 9K/12K e 1 split 18K",
        fixedPrice: 1550.0,
        items: [
          { serviceName: "Instalação Split 9K/12K", quantity: 1 },
          { serviceName: "Instalação Split 18K", quantity: 1 },
        ],
      },
      {
        name: "2x Split 9K/12K + 1x Split 18K",
        description: "Instalação de 2 splits 9K/12K e 1 split 18K",
        fixedPrice: 1970.0,
        items: [
          { serviceName: "Instalação Split 9K/12K", quantity: 2 },
          { serviceName: "Instalação Split 18K", quantity: 1 },
        ],
      },
      {
        name: "2x Split 24K",
        description: "Instalação de 2 splits de 24K",
        fixedPrice: 1895.0,
        items: [{ serviceName: "Instalação Split 24K", quantity: 2 }],
      },
      {
        name: "1x Split 9K/12K + 1x Split 24K",
        description: "Instalação de 1 split 9K/12K e 1 split 24K",
        fixedPrice: 1695.0,
        items: [
          { serviceName: "Instalação Split 9K/12K", quantity: 1 },
          { serviceName: "Instalação Split 24K", quantity: 1 },
        ],
      },
      {
        name: "2x Split 9K/12K + 1x Split 24K",
        description: "Instalação de 2 splits 9K/12K e 1 split 24K",
        fixedPrice: 2095.0,
        items: [
          { serviceName: "Instalação Split 9K/12K", quantity: 2 },
          { serviceName: "Instalação Split 24K", quantity: 1 },
        ],
      },
    ];

    for (const combo of combos) {
      const created = await prisma.serviceCombo.upsert({
        where: {
          companyId_name: {
            companyId,
            name: combo.name,
          },
        },
        update: {
          description: combo.description,
          fixedPrice: combo.fixedPrice,
        },
        create: {
          companyId,
          name: combo.name,
          description: combo.description,
          fixedPrice: combo.fixedPrice,
          isActive: true,
        },
      });

      await prisma.serviceComboItem.deleteMany({
        where: { comboId: created.id },
      });

      for (const item of combo.items) {
        const serviceId = createdServices[item.serviceName];
        if (serviceId) {
          await prisma.serviceComboItem.create({
            data: {
              comboId: created.id,
              serviceId,
              quantity: item.quantity,
            },
          });
        }
      }

      results.combos++;
    }

    // ========================================
    // 4. CRIAR ADICIONAIS
    // ========================================
    const additionals = [
      {
        name: "Rapel",
        description: "Adicional para serviços que necessitam de trabalho em altura com técnica de rapel.",
        price: 650.0,
        appliesToCategories: ["Instalação", "Desinstalação", "Manutenção", "Limpeza"],
      },
    ];

    for (const additional of additionals) {
      await prisma.serviceAdditional.upsert({
        where: {
          companyId_name: {
            companyId,
            name: additional.name,
          },
        },
        update: {
          description: additional.description,
          price: additional.price,
          appliesToCategories: additional.appliesToCategories,
        },
        create: {
          companyId,
          name: additional.name,
          description: additional.description,
          price: additional.price,
          appliesToCategories: additional.appliesToCategories,
          isActive: true,
        },
      });

      results.additionals++;
    }

    // ========================================
    // 5. CRIAR EXCEÇÕES DE ZONA
    // ========================================
    const ilhaZoneId = createdZones["Ilha"];
    const extremosZoneId = createdZones["Extremos da Ilha"];

    if (ilhaZoneId) {
      const existingException = await prisma.serviceZoneException.findFirst({
        where: {
          companyId,
          zoneId: ilhaZoneId,
          category: "Limpeza",
        },
      });

      if (!existingException) {
        await prisma.serviceZoneException.create({
          data: {
            companyId,
            zoneId: ilhaZoneId,
            category: "Limpeza",
            minQuantity: 3,
            exceptionType: "NO_FEE",
            description: "Limpeza de mais de 02 equipamentos não tem taxa da Ilha",
          },
        });
        results.exceptions++;
      }
    }

    if (extremosZoneId) {
      const existingException = await prisma.serviceZoneException.findFirst({
        where: {
          companyId,
          zoneId: extremosZoneId,
          category: "Limpeza",
        },
      });

      if (!existingException) {
        await prisma.serviceZoneException.create({
          data: {
            companyId,
            zoneId: extremosZoneId,
            category: "Limpeza",
            minQuantity: 3,
            exceptionType: "NO_QUOTE_REQUIRED",
            description: "Limpeza de mais de 02 máquinas nos Extremos pode ser orçada normalmente",
          },
        });
        results.exceptions++;
      }
    }

    return {
      success: true,
      companyName: company.name,
      results,
    };
  },
};
