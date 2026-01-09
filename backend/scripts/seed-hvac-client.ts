/**
 * Script de Seed para Cliente HVAC (Ar Condicionado)
 * Company ID: 43c57eb3-a773-45e2-8d6c-0c33b4da9b81
 *
 * Para executar em PRODUÇÃO:
 * DATABASE_URL="sua_url_de_producao" npx ts-node scripts/seed-hvac-client.ts
 *
 * Para executar localmente (usa .env):
 * npx ts-node scripts/seed-hvac-client.ts
 */

import { PrismaClient, ZonePricingType } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_ID = '43c57eb3-a773-45e2-8d6c-0c33b4da9b81';

async function main() {
  console.log('🚀 Iniciando seed para cliente HVAC...');
  console.log(`📍 Company ID: ${COMPANY_ID}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

  // Verifica se a empresa existe
  const company = await prisma.company.findUnique({
    where: { id: COMPANY_ID }
  });

  if (!company) {
    throw new Error(`❌ Empresa com ID ${COMPANY_ID} não encontrada!`);
  }

  console.log(`✅ Empresa encontrada: ${company.name}`);

  // ========================================
  // 1. CRIAR SERVIÇOS
  // ========================================
  console.log('\n📦 Criando serviços...');

  const services = [
    // Instalações 9K/12K
    {
      name: 'Instalação Split 9K/12K',
      description: 'Instalação de ar condicionado split 9.000 ou 12.000 BTUs. Inclui infra pronta ou furo/furo.',
      basePrice: 795.00,
      category: 'Instalação',
      pricingTiers: [] // Preço único
    },
    // Instalação 18K
    {
      name: 'Instalação Split 18K',
      description: 'Instalação de ar condicionado split 18.000 BTUs. Inclui infra pronta ou furo/furo.',
      basePrice: 855.00,
      category: 'Instalação',
      pricingTiers: []
    },
    // Instalação 24K
    {
      name: 'Instalação Split 24K',
      description: 'Instalação de ar condicionado split 24.000 BTUs. Inclui infra pronta ou furo/furo.',
      basePrice: 995.00,
      category: 'Instalação',
      pricingTiers: []
    },
    // Desinstalação com tiers
    {
      name: 'Desinstalação Split até 24K',
      description: 'Desinstalação de ar condicionado split até 24.000 BTUs.',
      basePrice: 275.00,
      category: 'Desinstalação',
      pricingTiers: [
        { minQuantity: 1, maxQuantity: 1, pricePerUnit: 275.00 },
        { minQuantity: 2, maxQuantity: 4, pricePerUnit: 250.00 },
        { minQuantity: 5, maxQuantity: null, pricePerUnit: 200.00 },
      ]
    },
    // Limpeza com tiers
    {
      name: 'Limpeza Split',
      description: 'Limpeza completa de ar condicionado split (evaporadora e condensadora).',
      basePrice: 250.00,
      category: 'Limpeza',
      pricingTiers: [
        { minQuantity: 1, maxQuantity: 1, pricePerUnit: 250.00 },
        { minQuantity: 2, maxQuantity: 2, pricePerUnit: 225.00 }, // 450/2
        { minQuantity: 3, maxQuantity: 3, pricePerUnit: 198.33 }, // 595/3
        { minQuantity: 4, maxQuantity: 4, pricePerUnit: 198.75 }, // 795/4
        { minQuantity: 5, maxQuantity: null, pricePerUnit: 190.00 },
      ]
    },
    // Manutenção Corretiva
    {
      name: 'Visita Técnica',
      description: 'Visita técnica para diagnóstico e avaliação do equipamento.',
      basePrice: 240.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Mão de Obra Corretiva Básica',
      description: 'Mão de obra para corretiva básica (troca de placa, motor, ajustes técnicos). Peças não inclusas.',
      basePrice: 320.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Carga de Gás Split 9K/12K',
      description: 'Carga de gás refrigerante para split 9.000 a 12.000 BTUs.',
      basePrice: 395.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Carga de Gás Split 18K/24K',
      description: 'Carga de gás refrigerante para split 18.000 a 24.000 BTUs. Inclui aperto na porca, solda simples, correção de flanges.',
      basePrice: 495.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Correção Vazamento + Carga Gás 9K/12K',
      description: 'Correção de vazamento com carga de gás para split 9K a 12K sem nitrogênio (aperto na porca, solda simples, flange).',
      basePrice: 595.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Correção Vazamento + Carga Gás 18K/24K',
      description: 'Correção de vazamento com carga de gás para split 18K a 24K sem nitrogênio (aperto na porca, solda simples, correção flanges).',
      basePrice: 695.00,
      category: 'Manutenção',
      pricingTiers: []
    },
    {
      name: 'Placa Universal',
      description: 'Instalação de placa universal (peças + mão de obra inclusa).',
      basePrice: 695.00,
      category: 'Manutenção',
      pricingTiers: []
    },
  ];

  const createdServices: { [key: string]: string } = {};

  for (const service of services) {
    const created = await prisma.service.upsert({
      where: {
        companyId_name: {
          companyId: COMPANY_ID,
          name: service.name,
        }
      },
      update: {
        description: service.description,
        basePrice: service.basePrice,
        category: service.category,
      },
      create: {
        companyId: COMPANY_ID,
        name: service.name,
        description: service.description,
        basePrice: service.basePrice,
        category: service.category,
        isActive: true,
      }
    });

    createdServices[service.name] = created.id;
    console.log(`  ✅ Serviço: ${service.name}`);

    // Criar pricing tiers se existirem
    if (service.pricingTiers.length > 0) {
      // Remove tiers antigos
      await prisma.servicePricingTier.deleteMany({
        where: { serviceId: created.id }
      });

      // Cria novos tiers
      for (const tier of service.pricingTiers) {
        await prisma.servicePricingTier.create({
          data: {
            serviceId: created.id,
            minQuantity: tier.minQuantity,
            maxQuantity: tier.maxQuantity,
            pricePerUnit: tier.pricePerUnit,
          }
        });
      }
      console.log(`     📊 ${service.pricingTiers.length} faixas de preço criadas`);
    }
  }

  // ========================================
  // 2. CRIAR ZONAS
  // ========================================
  console.log('\n🗺️ Criando zonas de atendimento...');

  const zones = [
    {
      name: 'Continente',
      description: 'São José, Biguaçu, Parte Continental de Florianópolis, Palhoça até Guarda do Cubatão',
      pricingType: ZonePricingType.FIXED,
      priceModifier: 0,
      isDefault: true,
      requiresQuote: false,
      neighborhoods: [
        // São José - todos os bairros (principais)
        'São José', 'Kobrasol', 'Campinas', 'Barreiros', 'Forquilhinhas', 'Ipiranga', 'Serraria',
        'Praia Comprida', 'Fazenda Santo Antônio', 'Roçado', 'Bela Vista',
        // Biguaçu
        'Biguaçu', 'Fundos', 'Vendaval',
        // Parte Continental de Florianópolis
        'Balneário do Estreito', 'Capoeiras', 'Coqueiros', 'Estreito', 'Abraão',
        'Bom Abrigo', 'Itaguaçu', 'Canto', 'Coloninha', 'Jardim Atlântico',
        // Palhoça
        'Palhoça', 'Ponte do Imaruim', 'Aririú', 'Barra do Aririú', 'Guarda do Cubatão',
        'Pagani', 'Passa Vinte', 'São Sebastião',
      ],
    },
    {
      name: 'Ilha',
      description: 'Parte da Ilha de Florianópolis com adicional de R$ 55,00',
      pricingType: ZonePricingType.FIXED,
      priceModifier: 55.00,
      isDefault: false,
      requiresQuote: false,
      neighborhoods: [
        // Região Central
        'Agronômica', 'Centro', 'Saco dos Limões', 'Trindade', 'Pantanal',
        'Santa Mônica', 'João Paulo', 'Monte Verde',
        // Região Leste
        'Itacorubi', 'Córrego Grande', 'Carvoeira', 'Joaquina',
        'Lagoa da Conceição', 'Parque São Jorge',
        // Região Sul
        'Campeche', 'Carianos', 'Costeira do Pirajubaé', 'Rio Tavares', 'Morro das Pedras',
        // Região Norte
        'Santo Antônio de Lisboa', 'Cacupé',
      ],
    },
    {
      name: 'Extremos da Ilha',
      description: 'Bairros nos extremos da Ilha - atendimento somente com orçamento especial',
      pricingType: ZonePricingType.FIXED,
      priceModifier: 0,
      isDefault: false,
      requiresQuote: true,
      neighborhoods: [
        'Cachoeira do Bom Jesus', 'Canasvieiras', 'Ingleses', 'Jurerê',
        'Jurerê Internacional', 'Ponta das Canas', 'Praia Brava',
        'São João do Rio Vermelho', 'Vargem Grande', 'Vargem Pequena',
        'Ratones', 'Rio Vermelho', 'Sambaqui', 'Barra da Lagoa',
        'Canto da Lagoa', 'Praia Mole', 'Pantano do Sul', 'Ribeirão da Ilha',
        'Tapera', 'Açores', 'Caeira da Barra do Sul', 'Solidão',
      ],
    },
  ];

  const createdZones: { [key: string]: string } = {};

  for (const zone of zones) {
    const created = await prisma.serviceZone.upsert({
      where: {
        companyId_name: {
          companyId: COMPANY_ID,
          name: zone.name,
        }
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
        companyId: COMPANY_ID,
        name: zone.name,
        description: zone.description,
        pricingType: zone.pricingType,
        priceModifier: zone.priceModifier,
        isDefault: zone.isDefault,
        requiresQuote: zone.requiresQuote,
        neighborhoods: zone.neighborhoods,
      }
    });

    createdZones[zone.name] = created.id;
    console.log(`  ✅ Zona: ${zone.name} (${zone.neighborhoods.length} bairros)`);
  }

  // ========================================
  // 3. CRIAR COMBOS
  // ========================================
  console.log('\n🎁 Criando combos de instalação...');

  const combos = [
    {
      name: '2x Split 9K/12K',
      description: 'Instalação de 2 splits de 9K ou 12K',
      fixedPrice: 1495.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 2 },
      ]
    },
    {
      name: '3x Split 9K/12K',
      description: 'Instalação de 3 splits de 9K ou 12K',
      fixedPrice: 1898.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 3 },
      ]
    },
    {
      name: '2x Split 18K',
      description: 'Instalação de 2 splits de 18K',
      fixedPrice: 1590.00,
      items: [
        { serviceName: 'Instalação Split 18K', quantity: 2 },
      ]
    },
    {
      name: '1x Split 9K/12K + 1x Split 18K',
      description: 'Instalação de 1 split 9K/12K e 1 split 18K',
      fixedPrice: 1550.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 1 },
        { serviceName: 'Instalação Split 18K', quantity: 1 },
      ]
    },
    {
      name: '2x Split 9K/12K + 1x Split 18K',
      description: 'Instalação de 2 splits 9K/12K e 1 split 18K',
      fixedPrice: 1970.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 2 },
        { serviceName: 'Instalação Split 18K', quantity: 1 },
      ]
    },
    {
      name: '2x Split 24K',
      description: 'Instalação de 2 splits de 24K',
      fixedPrice: 1895.00,
      items: [
        { serviceName: 'Instalação Split 24K', quantity: 2 },
      ]
    },
    {
      name: '1x Split 9K/12K + 1x Split 24K',
      description: 'Instalação de 1 split 9K/12K e 1 split 24K',
      fixedPrice: 1695.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 1 },
        { serviceName: 'Instalação Split 24K', quantity: 1 },
      ]
    },
    {
      name: '2x Split 9K/12K + 1x Split 24K',
      description: 'Instalação de 2 splits 9K/12K e 1 split 24K',
      fixedPrice: 2095.00,
      items: [
        { serviceName: 'Instalação Split 9K/12K', quantity: 2 },
        { serviceName: 'Instalação Split 24K', quantity: 1 },
      ]
    },
  ];

  for (const combo of combos) {
    const created = await prisma.serviceCombo.upsert({
      where: {
        companyId_name: {
          companyId: COMPANY_ID,
          name: combo.name,
        }
      },
      update: {
        description: combo.description,
        fixedPrice: combo.fixedPrice,
      },
      create: {
        companyId: COMPANY_ID,
        name: combo.name,
        description: combo.description,
        fixedPrice: combo.fixedPrice,
        isActive: true,
      }
    });

    // Remove items antigos
    await prisma.serviceComboItem.deleteMany({
      where: { comboId: created.id }
    });

    // Cria items do combo
    for (const item of combo.items) {
      const serviceId = createdServices[item.serviceName];
      if (serviceId) {
        await prisma.serviceComboItem.create({
          data: {
            comboId: created.id,
            serviceId,
            quantity: item.quantity,
          }
        });
      }
    }

    console.log(`  ✅ Combo: ${combo.name} - R$ ${combo.fixedPrice}`);
  }

  // ========================================
  // 4. CRIAR ADICIONAIS
  // ========================================
  console.log('\n➕ Criando adicionais...');

  const additionals = [
    {
      name: 'Rapel',
      description: 'Adicional para serviços que necessitam de trabalho em altura com técnica de rapel.',
      price: 650.00,
      appliesToCategories: ['Instalação', 'Desinstalação', 'Manutenção', 'Limpeza'],
    },
  ];

  for (const additional of additionals) {
    await prisma.serviceAdditional.upsert({
      where: {
        companyId_name: {
          companyId: COMPANY_ID,
          name: additional.name,
        }
      },
      update: {
        description: additional.description,
        price: additional.price,
        appliesToCategories: additional.appliesToCategories,
      },
      create: {
        companyId: COMPANY_ID,
        name: additional.name,
        description: additional.description,
        price: additional.price,
        appliesToCategories: additional.appliesToCategories,
        isActive: true,
      }
    });

    console.log(`  ✅ Adicional: ${additional.name} - R$ ${additional.price}`);
  }

  // ========================================
  // 5. CRIAR EXCEÇÕES DE ZONA
  // ========================================
  console.log('\n⚠️ Criando exceções de zona...');

  const ilhaZoneId = createdZones['Ilha'];
  const extremosZoneId = createdZones['Extremos da Ilha'];

  if (ilhaZoneId) {
    // Exceção: Limpeza de +2 equipamentos não tem taxa da Ilha
    const existingException = await prisma.serviceZoneException.findFirst({
      where: {
        companyId: COMPANY_ID,
        zoneId: ilhaZoneId,
        category: 'Limpeza',
      }
    });

    if (!existingException) {
      await prisma.serviceZoneException.create({
        data: {
          companyId: COMPANY_ID,
          zoneId: ilhaZoneId,
          category: 'Limpeza',
          minQuantity: 3, // mais de 2 = 3 ou mais
          exceptionType: 'NO_FEE',
          description: 'Limpeza de mais de 02 equipamentos não tem taxa da Ilha',
        }
      });
      console.log(`  ✅ Exceção: Limpeza 3+ equipamentos sem taxa na Ilha`);
    } else {
      console.log(`  ⏭️ Exceção já existe: Limpeza na Ilha`);
    }
  }

  if (extremosZoneId) {
    // Exceção: Limpeza de +2 máquinas nos Extremos pode ser orçada normalmente
    const existingException = await prisma.serviceZoneException.findFirst({
      where: {
        companyId: COMPANY_ID,
        zoneId: extremosZoneId,
        category: 'Limpeza',
      }
    });

    if (!existingException) {
      await prisma.serviceZoneException.create({
        data: {
          companyId: COMPANY_ID,
          zoneId: extremosZoneId,
          category: 'Limpeza',
          minQuantity: 3,
          exceptionType: 'NO_QUOTE_REQUIRED',
          description: 'Limpeza de mais de 02 máquinas nos Extremos pode ser orçada normalmente',
        }
      });
      console.log(`  ✅ Exceção: Limpeza 3+ equipamentos nos Extremos sem necessidade de planilha`);
    } else {
      console.log(`  ⏭️ Exceção já existe: Limpeza nos Extremos`);
    }
  }

  // ========================================
  // RESUMO FINAL
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('✅ SEED CONCLUÍDO COM SUCESSO!');
  console.log('='.repeat(50));
  console.log(`📦 Serviços criados: ${Object.keys(createdServices).length}`);
  console.log(`🗺️ Zonas criadas: ${Object.keys(createdZones).length}`);
  console.log(`🎁 Combos criados: ${combos.length}`);
  console.log(`➕ Adicionais criados: ${additionals.length}`);
  console.log(`⚠️ Exceções configuradas: 2`);
  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
