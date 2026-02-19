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
  const aiKnowledge = await prisma.aIKnowledge.create({
    data: {
      companyId: company.id,
      companyInfo: `A ClimaTech é especializada em instalação, manutenção e conserto de ar condicionado em São Paulo e região metropolitana.
Atuamos há mais de 15 anos no mercado, com técnicos certificados e garantia de qualidade em todos os serviços.

Horário de Atendimento: Segunda a Sexta, 8h às 18h | Sábado, 8h às 12h
Endereço: Rua das Flores, 123 - Centro, São Paulo - SP
Telefone: (11) 98765-4321
WhatsApp: (11) 98765-4321`,

      productsServices: `**INSTALAÇÃO:**
• Ar Split (9.000 a 60.000 BTUs) - A partir de R$ 350,00
• Ar Janela (7.500 a 30.000 BTUs) - A partir de R$ 250,00
• Ar Multi-Split (2 a 5 evaporadoras) - A partir de R$ 800,00
• Ar Cassete (12.000 a 60.000 BTUs) - Orçamento sob consulta
• Instalação inclui: Tubulação até 3 metros, suporte, mão de obra e teste

**MANUTENÇÃO PREVENTIVA:**
• Limpeza completa (filtros, serpentina, dreno) - R$ 120,00
• Higienização com produto bactericida - R$ 180,00
• Carga de gás R410A ou R22 - A partir de R$ 200,00
• Plano mensal de manutenção - A partir de R$ 89,00/mês

**CONSERTOS:**
• Diagnóstico técnico - R$ 80,00 (descontado se fechar o serviço)
• Troca de placa eletrônica - A partir de R$ 350,00
• Troca de compressor - A partir de R$ 650,00
• Troca de motor ventilador - A partir de R$ 280,00
• Reparo de vazamento de gás - A partir de R$ 200,00

**GARANTIA:**
• Instalação: 90 dias
• Manutenção: 30 dias
• Peças originais: 90 dias`,

      toneInstructions: `Seja profissional, prestativo e técnico quando necessário.
Use linguagem clara e acessível, explicando termos técnicos quando usar.
Demonstre expertise no assunto, mas sem ser arrogante.
Seja proativo em oferecer soluções e agendar visitas técnicas.
Use emojis ocasionalmente para deixar a conversa mais amigável (❄️, 🔧, ✅).
Sempre confirme dados importantes como endereço e horário antes de agendar.`,

      policies: `**AGENDAMENTO:**
• Agende visitas técnicas de segunda a sexta, entre 8h e 18h
• Sábados até 12h
• Domingos e feriados não atendemos
• Peça sempre: nome completo, endereço completo, telefone e descrição do problema
• Confirme data e horário antes de finalizar

**PAGAMENTO:**
• Aceitamos: Dinheiro, PIX, Cartão de Crédito/Débito
• Parcelamento em até 3x sem juros no cartão
• PIX tem 5% de desconto
• Orçamento sem compromisso

**EMERGÊNCIAS:**
• Vazamento de gás: atenda com urgência, agendamento em até 24h
• Ar não liga: pergunte se verificou disjuntor e pilhas do controle antes
• Ar não gela: pode ser falta de gás ou filtro sujo, ofereça manutenção

**NÃO PROMETEMOS:**
• Valor exato sem visita técnica (exceto serviços padrão como limpeza)
• Atendimento imediato (sempre agendar)
• Descontos além dos já oferecidos`,

      // Campos novos - configurações avançadas
      aiTone: 'professional',
      aiProactivity: 'medium',
      aiClosingFocus: false,
      aiCustomInstructions: 'Sempre priorize a experiência do cliente e a clareza técnica.',

      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500,
      autoReplyEnabled: true,
      replyDelay: 10,
    },
  });
  console.log('✓ Created AI Knowledge configuration');

  // Cria algumas tags padrão
  const tags = await Promise.all([
    prisma.tag.create({
      data: {
        companyId: company.id,
        name: 'VIP',
        color: '#FFD700',
      },
    }),
    prisma.tag.create({
      data: {
        companyId: company.id,
        name: 'Urgente',
        color: '#FF0000',
      },
    }),
    prisma.tag.create({
      data: {
        companyId: company.id,
        name: 'Manutenção Preventiva',
        color: '#00AA00',
      },
    }),
    prisma.tag.create({
      data: {
        companyId: company.id,
        name: 'Instalação',
        color: '#0066FF',
      },
    }),
    prisma.tag.create({
      data: {
        companyId: company.id,
        name: 'Conserto',
        color: '#FF6600',
      },
    }),
  ]);
  console.log(`✓ Created ${tags.length} tags`);

  // Cria alguns clientes de exemplo
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'João Silva',
        phone: '5511987654321',
        email: 'joao.silva@email.com',
        tags: ['VIP', 'Manutenção Preventiva'],
        notes: 'Cliente há 3 anos. Tem 2 aparelhos Split 12.000 BTUs. Contrato mensal de manutenção.',
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'Maria Santos',
        phone: '5511876543210',
        email: 'maria.santos@email.com',
        tags: ['Instalação'],
        notes: 'Orçamento aprovado para instalação de Split 18.000 BTUs. Aguardando agendamento.',
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        name: 'Carlos Oliveira',
        phone: '5511765432109',
        tags: ['Urgente', 'Conserto'],
        notes: 'Ar condicionado não está gelando. Solicitou urgência.',
      },
    }),
  ]);
  console.log(`✓ Created ${customers.length} example customers`);

  // Cria Zonas de Atendimento
  console.log('🌍 Creating Service Zones...');
  const zones = await Promise.all([
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Continente',
        description: 'São José, Biguaçu, Parte Continental de Fpolis, Palhoça até Guarda do Cubatão',
        isDefault: true,
        priceModifier: 0,
        neighborhoods: [
          'Balneário do Estreito', 'Capoeiras', 'Coqueiros', 'Estreito', 'Abraão', 
          'Bom Abrigo', 'Itaguaçu', 'Canto', 'Coloninha', 'Jardim Atlântico'
        ]
      },
    }),
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Ilha de Florianópolis',
        description: 'Centro, Norte, Sul e Leste da Ilha (Adicional de R$ 55,00)',
        priceModifier: 55.00,
        neighborhoods: [
          'Agronômica', 'Centro', 'Saco dos Limões', 'Trindade', 'Pantanal', 'Santa Mônica', 'João Paulo', 'Monte Verde',
          'Itacorubi', 'Córrego Grande', 'Carvoeira', 'Joaquina', 'Lagoa da Conceição', 'Parque São Jorge',
          'Campeche', 'Carianos', 'Costeira do Pirajubaé', 'Rio Tavares', 'Morro das Pedras',
          'Santo Antônio de Lisboa', 'Cacupé'
        ]
      },
    }),
    prisma.serviceZone.create({
      data: {
        companyId: company.id,
        name: 'Extremos da Ilha / Especiais',
        description: 'Norte Extremo e Sul Profundo (Apenas via orçamento)',
        requiresQuote: true,
        priceModifier: 0,
        neighborhoods: [
          'Cachoeira do Bom Jesus', 'Canasvieiras', 'Ingleses', 'Jurerê', 'Jurerê Internacional', 'Ponta das Canas', 
          'Praia Brava', 'São João do Rio Vermelho', 'Vargem Grande', 'Vargem Pequena', 'Ratones', 'Rio Vermelho', 
          'Sambaqui', 'Barra da Lagoa', 'Canto da Lagoa', 'Praia Mole', 'Pântano do Sul', 'Ribeirão da Ilha', 
          'Tapera', 'Açores', 'Caieira da Barra do Sul', 'Solidão'
        ]
      },
    }),
  ]);

  // Cria Serviços Base
  console.log('📦 Creating Base Services...');
  const baseServices = await Promise.all([
    // INSTALAÇÃO
    prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Instalação Split 9K/12K',
        description: 'Instalação com infra pronta ou furo/furo',
        basePrice: 795.00,
        category: 'Instalação',
        equipmentType: '9K-12K',
        actionType: 'installation',
      }
    }),
    prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Instalação Split 18K',
        basePrice: 855.00,
        category: 'Instalação',
        equipmentType: '18K',
        actionType: 'installation',
      }
    }),
    prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Instalação Split 24K',
        basePrice: 995.00,
        category: 'Instalação',
        equipmentType: '24K',
        actionType: 'installation',
      }
    }),
    // DESINSTALAÇÃO
    prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Desinstalação Split até 24K',
        basePrice: 275.00,
        category: 'Desinstalação',
        actionType: 'deinstallation',
        pricingTiers: {
          create: [
            { minQuantity: 1, maxQuantity: 1, pricePerUnit: 275.00, order: 0 },
            { minQuantity: 2, maxQuantity: 4, pricePerUnit: 250.00, order: 1 },
            { minQuantity: 5, maxQuantity: null, pricePerUnit: 200.00, order: 2 },
          ]
        }
      }
    }),
    // LIMPEZA
    prisma.service.create({
      data: {
        companyId: company.id,
        name: 'Limpeza Split',
        basePrice: 250.00,
        category: 'Limpeza',
        actionType: 'cleaning',
        pricingTiers: {
          create: [
            { minQuantity: 1, maxQuantity: 1, pricePerUnit: 250.00, order: 0 },
            { minQuantity: 2, maxQuantity: 2, pricePerUnit: 225.00, order: 1 }, // 450 total / 2
            { minQuantity: 3, maxQuantity: 3, pricePerUnit: 198.33, order: 2 }, // 595 total / 3
            { minQuantity: 4, maxQuantity: 4, pricePerUnit: 198.75, order: 3 }, // 795 total / 4
            { minQuantity: 5, maxQuantity: null, pricePerUnit: 190.00, order: 4 },
          ]
        }
      }
    }),
    // MANUTENÇÃO / OUTROS
    prisma.service.create({
      data: { companyId: company.id, name: 'Visita Técnica', basePrice: 240.00, category: 'Manutenção' },
    }),
    prisma.service.create({
      data: { companyId: company.id, name: 'Mão de Obra Corretiva Básica', basePrice: 320.00, category: 'Manutenção' },
    }),
    prisma.service.create({
      data: { companyId: company.id, name: 'Carga de Gás 9K/12K', basePrice: 395.00, category: 'Manutenção' },
    }),
    prisma.service.create({
      data: { companyId: company.id, name: 'Carga de Gás 18K/24K', basePrice: 495.00, category: 'Manutenção' },
    }),
    prisma.service.create({
      data: { companyId: company.id, name: 'Placa Universal (Peças + MO)', basePrice: 695.00, category: 'Manutenção' },
    }),
  ]);

  // Cria Adicionais
  console.log('➕ Creating Additionals...');
  await prisma.serviceAdditional.createMany({
    data: [
      { companyId: company.id, name: 'Trabalho em Rapel', price: 650.00, appliesToCategories: ['Instalação', 'Limpeza', 'Manutenção'] },
      { companyId: company.id, name: 'Infraestrutura com Muita Fiação', price: 0, description: 'Requer orçamento via planilha' },
    ]
  });

  // Cria Exceções de Zona (Limpeza de +2 máquinas na Ilha não tem taxa)
  await prisma.serviceZoneException.create({
    data: {
      companyId: company.id,
      zoneId: zones[1].id, // Ilha
      category: 'Limpeza',
      minQuantity: 3,
      exceptionType: 'NO_FEE',
      description: 'Limpezas de mais de 02 equipamentos na Ilha não pagam taxa de deslocamento'
    }
  });

  // Cria Combos de Instalação
  console.log('📦 Creating Combos...');
  await Promise.all([
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 02 Split 9K/12K',
        fixedPrice: 1495.00,
        category: 'Instalação',
        items: {
          create: [{ serviceId: baseServices[0].id, quantity: 2 }]
        }
      }
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 03 Split 9K/12K',
        fixedPrice: 1898.00,
        category: 'Instalação',
        items: {
          create: [{ serviceId: baseServices[0].id, quantity: 3 }]
        }
      }
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Instalação 02 Split 18K',
        fixedPrice: 1590.00,
        category: 'Instalação',
        items: {
          create: [{ serviceId: baseServices[1].id, quantity: 2 }]
        }
      }
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 01x(9K/12K) + 01x(18K)',
        fixedPrice: 1550.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: baseServices[0].id, quantity: 1 },
            { serviceId: baseServices[1].id, quantity: 1 },
          ]
        }
      }
    }),
    prisma.serviceCombo.create({
      data: {
        companyId: company.id,
        name: 'Combo 02x(9K/12K) + 01x(18K)',
        fixedPrice: 1970.00,
        category: 'Instalação',
        items: {
          create: [
            { serviceId: baseServices[0].id, quantity: 2 },
            { serviceId: baseServices[1].id, quantity: 1 },
          ]
        }
      }
    }),
  ]);

  console.log('✓ Seeding process for expanded services completed');

  console.log('\n✅ Seed completed successfully!\n');
  console.log('📧 Login credentials:');
  console.log('   Email: teste@gmail.com');
  console.log('   Password: senha123\n');
  console.log('🏢 Company: ClimaTech Ar Condicionado');
  console.log('🤖 AI configured with air conditioning knowledge');
  console.log(`👥 ${customers.length} example customers created`);
  console.log(`📦 ${baseServices.length} services and products created`);
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
