import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Limpa dados existentes (ordem importa por causa das foreign keys)
  await prisma.conversationExample.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.message.deleteMany();
  await prisma.serviceAdditional.deleteMany();
  await prisma.serviceComboItem.deleteMany();
  await prisma.serviceCombo.deleteMany();
  await prisma.servicePricingTier.deleteMany();
  await prisma.serviceVariableOption.deleteMany();
  await prisma.serviceVariable.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceZone.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.whatsAppInstance.deleteMany();
  await prisma.aIKnowledge.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log('✓ Cleared existing data');

  // Cria empresa
  const company = await prisma.company.create({
    data: {
      name: 'ClimaTech Ar Condicionado',
    },
  });
  console.log(`✓ Created company: ${company.name}`);

  // Hash da senha
  const passwordHash = await bcrypt.hash('senha123', 10);

  // Cria usuário admin
  const user = await prisma.user.create({
    data: {
      email: 'teste@gmail.com',
      passwordHash,
      name: 'Admin ClimaTech',
      role: 'ADMIN',
      companyId: company.id,
    },
  });
  console.log(`✓ Created user: ${user.email} (password: senha123)`);

  // Cria configuração da IA com conhecimento detalhado sobre ar condicionado
  await prisma.aIKnowledge.create({
    data: {
      companyId: company.id,
      companyName: 'ClimaTech Ar Condicionado',
      companySegment: 'Instalação, manutenção e limpeza de ar condicionado',
      companyDescription:
        'A ClimaTech é especializada em instalação, manutenção, limpeza e conserto de ar condicionado em Florianópolis e região. Atendemos São José, Biguaçu, Palhoça (até Guarda do Cubatão), parte continental e ilha de Florianópolis. Técnicos certificados, garantia em todos os serviços.',

      companyInfo: `A ClimaTech é especializada em instalação, manutenção e conserto de ar condicionado em Florianópolis e região.
Atendemos São José, Biguaçu, parte continental de Florianópolis, Palhoça até Guarda do Cubatão e Ilha de Florianópolis.

Horário de Atendimento: Segunda a Sexta, 8h às 18h | Sábado, 8h às 12h
WhatsApp: (48) 99999-0000`,

      policies: `**REGIÕES DE ATENDIMENTO:**
• Continente (preço padrão): São José, Biguaçu, Parte Continental de Florianópolis, Palhoça até Guarda do Cubatão
  Bairros: Balneário do Estreito, Capoeiras, Coqueiros, Estreito, Abraão, Bom Abrigo, Itaguaçu, Canto, Coloninha, Jardim Atlântico
• Ilha de Florianópolis (adicional R$ 55,00): Centro, Norte, Sul e Leste (exceto extremos)
  - Região Central: Agronômica, Centro, Saco dos Limões, Trindade, Pantanal, Santa Mônica, João Paulo, Monte Verde
  - Região Leste: Itacorubi, Córrego Grande, Carvoeira, Joaquina, Lagoa da Conceição, Parque São Jorge
  - Região Sul: Campeche, Carianos, Costeira do Pirajubaé, Rio Tavares, Morro das Pedras
  - Região Norte: Santo Antônio de Lisboa, João Paulo, Cacupé, Monte Verde
• Extremos da Ilha (apenas sob orçamento especial, preços mais elevados): Canasvieiras, Ingleses, Jurerê, Jurerê Internacional, Barra da Lagoa, Pantano do Sul, Ribeirão da Ilha, e outros extremos

**OBSERVAÇÕES IMPORTANTES:**
• Preços consideram instalações com infra pronta ou furo/furo
• Rapel tem adicional de R$ 650,00
• Limpezas de mais de 02 equipamentos na Ilha NÃO pagam a taxa de R$ 55,00
• Equipamentos Piso/Teto e K7: sempre via planilha
• Instalações de 03+ equipamentos: sempre via planilha independente da região

**PAGAMENTO:**
• Aceitamos: Dinheiro, PIX, Cartão de Crédito/Débito
• PIX com desconto especial

**AGENDAMENTO:**
• Solicitar: nome completo, endereço completo com número, descrição do serviço
• Confirmar data e horário antes de finalizar`,

      paymentMethods: 'Dinheiro, PIX (com desconto), Cartão de Crédito e Débito',

      warrantyInfo: 'Instalação: 90 dias | Manutenção/Limpeza: 30 dias | Peças: conforme fabricante',

      toneInstructions: `Seja profissional, prestativo e técnico quando necessário.
Use linguagem clara e acessível, explicando termos técnicos quando necessário.
Demonstre expertise no assunto de forma acessível.
Seja proativo em oferecer soluções.
Use emojis ocasionalmente para deixar a conversa mais amigável (❄️, 🔧, ✅).
Sempre confirme endereço completo com número antes de agendar.`,

      aiTone: 'professional',
      aiProactivity: 'medium',
      aiClosingFocus: false,
      aiCustomInstructions:
        'Sempre pergunte o bairro do cliente para informar se há adicional de taxa de deslocamento da Ilha. Para limpezas de mais de 02 aparelhos na Ilha, informe que não há taxa adicional.',

      provider: 'gemini',
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      maxTokens: 800,
      autoReplyEnabled: true,
      replyDelay: 10,
    },
  });
  console.log('✓ Created AI Knowledge configuration');

  // Cria algumas tags padrão
  const tags = await Promise.all([
    prisma.tag.create({ data: { companyId: company.id, name: 'VIP', color: '#FFD700' } }),
    prisma.tag.create({ data: { companyId: company.id, name: 'Urgente', color: '#FF0000' } }),
    prisma.tag.create({ data: { companyId: company.id, name: 'Manutenção Preventiva', color: '#00AA00' } }),
    prisma.tag.create({ data: { companyId: company.id, name: 'Instalação', color: '#0066FF' } }),
    prisma.tag.create({ data: { companyId: company.id, name: 'Conserto', color: '#FF6600' } }),
  ]);
  console.log(`✓ Created ${tags.length} tags`);

  // Cria alguns clientes de exemplo
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'João Silva',
        phone: '5548987654321',
        email: 'joao.silva@email.com',
        tags: ['VIP', 'Manutenção Preventiva'],
        notes: 'Cliente antigo. Tem 2 aparelhos Split 12K. Mora em Coqueiros (Continente).',
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'Maria Santos',
        phone: '5548876543210',
        email: 'maria.santos@email.com',
        tags: ['Instalação'],
        notes: 'Orçamento aprovado para instalação de Split 18K. Mora na Trindade (Ilha). Aguardando agendamento.',
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'Carlos Oliveira',
        phone: '5548765432109',
        tags: ['Urgente', 'Conserto'],
        notes: 'Ar condicionado não está gelando. Mora no Campeche (Ilha). Solicitou urgência.',
      },
    }),
  ]);
  console.log(`✓ Created ${customers.length} example customers`);

  // ============================================================
  // ZONAS DE ATENDIMENTO
  // ============================================================
  console.log('🌍 Creating Service Zones...');
  const zones = await Promise.all([
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Continente',
        description:
          'São José, Biguaçu, Parte Continental de Florianópolis, Palhoça até Guarda do Cubatão. Preço padrão sem adicional.',
        isDefault: true,
        pricingType: 'FIXED',
        priceModifier: 0,
        neighborhoods: [
          'Balneário do Estreito', 'Capoeiras', 'Coqueiros', 'Estreito', 'Abraão',
          'Bom Abrigo', 'Itaguaçu', 'Canto', 'Coloninha', 'Jardim Atlântico',
          'São José', 'Biguaçu', 'Palhoça', 'Guarda do Cubatão',
        ],
      },
    }),
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Ilha de Florianópolis',
        description:
          'Centro, Norte, Sul e Leste da Ilha. Adicional de R$ 55,00 por visita. Exceção: limpezas de 03+ equipamentos não pagam taxa.',
        pricingType: 'FIXED',
        priceModifier: 55.00,
        neighborhoods: [
          // Central
          'Agronômica', 'Centro', 'Saco dos Limões', 'Trindade', 'Pantanal', 'Santa Mônica', 'João Paulo', 'Monte Verde',
          // Leste
          'Itacorubi', 'Córrego Grande', 'Carvoeira', 'Joaquina', 'Lagoa da Conceição', 'Parque São Jorge',
          // Sul
          'Campeche', 'Carianos', 'Costeira do Pirajubaé', 'Rio Tavares', 'Morro das Pedras',
          // Norte
          'Santo Antônio de Lisboa', 'Cacupé',
        ],
      },
    }),
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Extremos da Ilha / Especiais',
        description:
          'Atendimento apenas sob orçamento especial com preços mais elevados. Consultar Igor ou Jorge.',
        requiresQuote: true,
        pricingType: 'FIXED',
        priceModifier: 0,
        neighborhoods: [
          'Cachoeira do Bom Jesus', 'Canasvieiras', 'Ingleses', 'Jurerê', 'Jurerê Internacional',
          'Ponta das Canas', 'Praia Brava', 'São João do Rio Vermelho', 'Vargem Grande', 'Vargem Pequena',
          'Ratones', 'Rio Vermelho', 'Sambaqui', 'Barra da Lagoa', 'Canto da Lagoa', 'Praia Mole',
          'Pântano do Sul', 'Ribeirão da Ilha', 'Tapera', 'Açores', 'Caieira da Barra do Sul', 'Solidão',
        ],
      },
    }),
  ]);
  console.log(`✓ Created ${zones.length} service zones`);

  // ============================================================
  // SERVIÇOS COM DESCRIÇÕES E VARIAÇÕES
  // ============================================================
  console.log('📦 Creating Services with variables...');

  // ------------------------------------------------------------------
  // 1. INSTALAÇÃO SPLIT 9K / 12K
  // ------------------------------------------------------------------
  const instSplit9k12k = await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Instalação Split 9K/12K',
      description:
        'Instalação de ar condicionado split de 9.000 ou 12.000 BTUs. Inclui fixação da evaporadora e condensadora, tubulação de cobre, passagem de elétrica e dreno (infra pronta ou furo/furo, até 3m de tubulação). Equipamentos Piso/Teto e K7 sempre via orçamento planilha.',
      basePrice: 795.00,
      category: 'Instalação',
      equipmentType: '9K-12K',
      actionType: 'installation',
      isActive: true,
      variables: {
        create: [
          {
            name: 'Quantidade de equipamentos',
            isRequired: true,
            order: 0,
            options: {
              create: [
                { name: '01 Split 9K/12K', priceModifier: 0.00, order: 0 },       // R$ 795,00
                { name: '02 Splits 9K/12K', priceModifier: 700.00, order: 1 },    // R$ 1.495,00
                { name: '03 Splits 9K/12K', priceModifier: 1103.00, order: 2 },   // R$ 1.898,00
              ],
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 2. INSTALAÇÃO SPLIT 18K
  // ------------------------------------------------------------------
  const instSplit18k = await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Instalação Split 18K',
      description:
        'Instalação de ar condicionado split de 18.000 BTUs. Inclui fixação da evaporadora e condensadora, tubulação de cobre, passagem de elétrica e dreno (infra pronta ou furo/furo). Para mais de 03 equipamentos ou regiões especiais, orçamento via planilha.',
      basePrice: 855.00,
      category: 'Instalação',
      equipmentType: '18K',
      actionType: 'installation',
      isActive: true,
      variables: {
        create: [
          {
            name: 'Quantidade de equipamentos',
            isRequired: true,
            order: 0,
            options: {
              create: [
                { name: '01 Split 18K', priceModifier: 0.00, order: 0 },      // R$ 855,00
                { name: '02 Splits 18K', priceModifier: 735.00, order: 1 },   // R$ 1.590,00
              ],
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 3. INSTALAÇÃO SPLIT 24K
  // ------------------------------------------------------------------
  const instSplit24k = await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Instalação Split 24K',
      description:
        'Instalação de ar condicionado split de 24.000 BTUs. Inclui fixação da evaporadora e condensadora, tubulação de cobre, passagem de elétrica e dreno (infra pronta ou furo/furo). Para mais de 03 equipamentos ou regiões especiais, orçamento via planilha.',
      basePrice: 995.00,
      category: 'Instalação',
      equipmentType: '24K',
      actionType: 'installation',
      isActive: true,
      variables: {
        create: [
          {
            name: 'Quantidade de equipamentos',
            isRequired: true,
            order: 0,
            options: {
              create: [
                { name: '01 Split 24K', priceModifier: 0.00, order: 0 },      // R$ 995,00
                { name: '02 Splits 24K', priceModifier: 900.00, order: 1 },   // R$ 1.895,00
              ],
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 4. DESINSTALAÇÃO SPLIT (com faixas de preço por quantidade)
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Desinstalação Split até 24K',
      description:
        'Desinstalação de ar condicionado split de qualquer capacidade (até 24.000 BTUs). Inclui retirada da evaporadora, condensadora, tubulação e entupimento dos furos. Para trabalhos em altura (rapel), há adicional de R$ 650,00. O preço por unidade diminui conforme a quantidade de equipamentos.',
      basePrice: 275.00,
      category: 'Desinstalação',
      actionType: 'deinstallation',
      isActive: true,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, pricePerUnit: 275.00, order: 0 },
          { minQuantity: 2, maxQuantity: 4, pricePerUnit: 250.00, order: 1 },
          { minQuantity: 5, maxQuantity: null, pricePerUnit: 200.00, order: 2 },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 5. LIMPEZA SPLIT (com faixas de preço por quantidade)
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Limpeza Split',
      description:
        'Limpeza completa do ar condicionado split: lavagem dos filtros, higienização da serpentina da evaporadora e condensadora, limpeza do dreno e da bandeja. Garante eficiência energética, ar mais puro e previne mau cheiro. Limpezas de 03+ equipamentos na Ilha de Florianópolis não pagam adicional de deslocamento.',
      basePrice: 250.00,
      category: 'Limpeza',
      actionType: 'cleaning',
      isActive: true,
      pricingTiers: {
        create: [
          { minQuantity: 1, maxQuantity: 1, pricePerUnit: 250.00, order: 0 },   // R$ 250,00
          { minQuantity: 2, maxQuantity: 2, pricePerUnit: 225.00, order: 1 },   // R$ 450,00 total
          { minQuantity: 3, maxQuantity: 3, pricePerUnit: 198.33, order: 2 },   // R$ 595,00 total
          { minQuantity: 4, maxQuantity: 4, pricePerUnit: 198.75, order: 3 },   // R$ 795,00 total
          { minQuantity: 5, maxQuantity: null, pricePerUnit: 190.00, order: 4 },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 6. MANUTENÇÃO CORRETIVA — VISITA TÉCNICA
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Visita Técnica',
      description:
        'Visita do técnico para diagnóstico e avaliação do problema no ar condicionado. O valor da visita é cobrado separadamente dos demais serviços de mão de obra e peças. Ideal para identificar falhas antes de definir o serviço necessário.',
      basePrice: 240.00,
      category: 'Manutenção',
      isActive: true,
    },
  });

  // ------------------------------------------------------------------
  // 7. MÃO DE OBRA CORRETIVA BÁSICA
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Mão de Obra Corretiva Básica',
      description:
        'Mão de obra para manutenção corretiva básica: troca de placa, troca de motor, ajustes técnicos e outros reparos simples. Não inclui peças (cobradas à parte) nem visita técnica.',
      basePrice: 320.00,
      category: 'Manutenção',
      isActive: true,
    },
  });

  // ------------------------------------------------------------------
  // 8. CARGA DE GÁS (com variação por BTU)
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Carga de Gás Split',
      description:
        'Recarga de gás refrigerante no ar condicionado split. Inclui verificação do sistema, adição do gás e teste de funcionamento. Preço varia conforme a capacidade do equipamento. Não inclui correção de vazamento (cobrada separadamente).',
      basePrice: 395.00,
      category: 'Manutenção',
      isActive: true,
      variables: {
        create: [
          {
            name: 'Capacidade do equipamento',
            isRequired: true,
            order: 0,
            options: {
              create: [
                { name: 'Split 9K ou 12K', priceModifier: 0.00, order: 0 },    // R$ 395,00
                { name: 'Split 18K ou 24K', priceModifier: 100.00, order: 1 }, // R$ 495,00
              ],
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 9. CORREÇÃO DE VAZAMENTO + CARGA DE GÁS (com variação por BTU)
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Correção de Vazamento + Carga de Gás',
      description:
        'Serviço completo de correção de vazamento de gás refrigerante com recarga. Inclui localização do vazamento, reparos simples (aperto de porca, solda simples, correção de flanges) e recarga de gás. Sem uso de nitrogênio. Para vazamentos complexos, pode ser necessário orçamento via planilha.',
      basePrice: 595.00,
      category: 'Manutenção',
      isActive: true,
      variables: {
        create: [
          {
            name: 'Capacidade do equipamento',
            isRequired: true,
            order: 0,
            options: {
              create: [
                {
                  name: 'Split 9K ou 12K (aperto de porca, solda simples, flange)',
                  priceModifier: 0.00,
                  order: 0,
                }, // R$ 595,00
                {
                  name: 'Split 18K ou 24K (aperto de porca, solda simples, correção de flanges)',
                  priceModifier: 100.00,
                  order: 1,
                }, // R$ 695,00
              ],
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------------------------------
  // 10. PLACA UNIVERSAL
  // ------------------------------------------------------------------
  await prisma.service.create({
    data: {
      companyId: company.id,
      name: 'Placa Universal (Peças + Mão de Obra)',
      description:
        'Fornecimento e instalação de placa de controle universal para ar condicionado split. Inclui a placa, programação e mão de obra de instalação. Solução para quando a placa original não está mais disponível ou tem custo muito elevado.',
      basePrice: 695.00,
      category: 'Manutenção',
      isActive: true,
    },
  });

  console.log('✓ Created base services with descriptions and variables');

  // ============================================================
  // ADICIONAIS
  // ============================================================
  console.log('➕ Creating Additionals...');
  await prisma.serviceAdditional.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Trabalho em Rapel',
        price: 650.00,
        description:
          'Adicional para serviços que exigem trabalho em altura com rapel (fachadas, andares elevados sem acesso fácil). Aplicável sobre qualquer serviço de instalação, desinstalação ou limpeza.',
        appliesToCategories: ['Instalação', 'Desinstalação', 'Limpeza'],
      },
      {
        companyId: company.id,
        name: 'Infraestrutura com Muita Fiação',
        price: 0,
        description:
          'Para instalações em lojas, casas ou apartamentos muito grandes com muita fiação na infra pronta, o preço não segue a tabela padrão. Requer orçamento via planilha.',
        appliesToCategories: ['Instalação'],
      },
      {
        companyId: company.id,
        name: 'Taxa de Deslocamento — Ilha de Florianópolis',
        price: 55.00,
        description:
          'Taxa adicional para serviços realizados na Ilha de Florianópolis (exceto limpezas de 03 ou mais equipamentos, que ficam isentas).',
        appliesToCategories: ['Instalação', 'Desinstalação', 'Manutenção'],
      },
    ],
  });
  console.log('✓ Created service additionals');

  // ============================================================
  // EXCEÇÃO DE ZONA (Limpeza de +2 máquinas na Ilha sem taxa)
  // ============================================================
  await prisma.serviceZoneException.create({
    data: {
      companyId: company.id,
      zoneId: zones[1].id, // Ilha
      category: 'Limpeza',
      minQuantity: 3,
      exceptionType: 'NO_FEE',
      description:
        'Limpezas de mais de 02 equipamentos na Ilha de Florianópolis ficam isentas da taxa de deslocamento de R$ 55,00.',
    },
  });
  console.log('✓ Created zone exception (island fee waiver for 3+ cleanings)');

  // ============================================================
  // COMBOS DE INSTALAÇÃO MISTA (9K/12K + 18K / + 24K)
  // ============================================================
  console.log('📦 Creating installation combos...');
  await Promise.all([
    // 02 Split 9K/12K — já coberto pela variação do serviço, mas combo explicita o desconto
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 02 Splits 9K/12K',
        description: 'Instalação de 02 aparelhos split de 9.000 ou 12.000 BTUs no mesmo atendimento.',
        fixedPrice: 1495.00,
        category: 'Instalação',
        items: { create: [{ serviceId: instSplit9k12k.id, quantity: 2 }] },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 03 Splits 9K/12K',
        description:
          'Instalação de 03 aparelhos split de 9.000 ou 12.000 BTUs no mesmo atendimento. Para 04+ equipamentos, orçamento obrigatório via planilha.',
        fixedPrice: 1898.00,
        category: 'Instalação',
        items: { create: [{ serviceId: instSplit9k12k.id, quantity: 3 }] },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 02 Splits 18K',
        description: 'Instalação de 02 aparelhos split de 18.000 BTUs no mesmo atendimento.',
        fixedPrice: 1590.00,
        category: 'Instalação',
        items: { create: [{ serviceId: instSplit18k.id, quantity: 2 }] },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 01x(9K/12K) + 01x(18K)',
        description: 'Instalação de 01 split 9K/12K e 01 split 18K no mesmo atendimento.',
        fixedPrice: 1550.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: instSplit9k12k.id, quantity: 1 },
            { serviceId: instSplit18k.id, quantity: 1 },
          ],
        },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 02x(9K/12K) + 01x(18K)',
        description: 'Instalação de 02 splits 9K/12K e 01 split 18K no mesmo atendimento.',
        fixedPrice: 1970.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: instSplit9k12k.id, quantity: 2 },
            { serviceId: instSplit18k.id, quantity: 1 },
          ],
        },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 02 Splits 24K',
        description: 'Instalação de 02 aparelhos split de 24.000 BTUs no mesmo atendimento.',
        fixedPrice: 1895.00,
        category: 'Instalação',
        items: { create: [{ serviceId: instSplit24k.id, quantity: 2 }] },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 01x(9K/12K) + 01x(24K)',
        description: 'Instalação de 01 split 9K/12K e 01 split 24K no mesmo atendimento.',
        fixedPrice: 1695.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: instSplit9k12k.id, quantity: 1 },
            { serviceId: instSplit24k.id, quantity: 1 },
          ],
        },
      },
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 02x(9K/12K) + 01x(24K)',
        description: 'Instalação de 02 splits 9K/12K e 01 split 24K no mesmo atendimento.',
        fixedPrice: 2095.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: instSplit9k12k.id, quantity: 2 },
            { serviceId: instSplit24k.id, quantity: 1 },
          ],
        },
      },
    }),
  ]);
  console.log('✓ Created installation combos');

  console.log('\n✅ Seed completed successfully!\n');
  console.log('📧 Login credentials:');
  console.log('   Email: teste@gmail.com');
  console.log('   Password: senha123\n');
  console.log('🏢 Company: ClimaTech Ar Condicionado');
  console.log('🌍 3 service zones created');
  console.log('📦 10 services with descriptions and variables created');
  console.log('🎁 8 installation combos created');
  console.log('➕ 3 service additionals created');
  console.log(`👥 ${customers.length} example customers created`);
  console.log(`🏷️  ${tags.length} tags created\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
