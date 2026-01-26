import { prisma } from "../utils/prisma";
import openaiService from "./ai-providers/openai.service";
import geminiService from "./ai-providers/gemini.service";
import { AIProvider } from "../types/ai-provider";
import { DEFAULT_SYNONYMS } from "../data/default-synonyms";

/**
 * ============================================
 * SEMANTIC SERVICE SERVICE
 * ============================================
 * Serviço responsável por busca semântica de serviços/produtos.
 *
 * Funcionalidades:
 * 1. Gerar embeddings ricos para serviços
 * 2. Busca semântica com expansão de sinônimos
 * 3. Detecção automática de relacionamentos entre serviços
 * 4. Enriquecimento de resultados com serviços relacionados
 */

// Configurações do serviço semântico
const SEMANTIC_CONFIG = {
  // Threshold de similaridade (0-1, quanto maior mais restritivo)
  SIMILARITY_THRESHOLD: 0.65,
  // Limite padrão de resultados
  DEFAULT_LIMIT: 5,
  // Provider padrão para embeddings
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER as AIProvider) ||
    (process.env.AI_PROVIDER as AIProvider) ||
    "openai",
};

// Tipos de relacionamento entre serviços
export type RelationshipType = "complement" | "alternative" | "upsell" | "same_equipment";

export interface ServiceSearchResult {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  category: string | null;
  equipmentType: string | null;
  actionType: string | null;
  similarity: number;
  matchedTerms?: string[];
  relatedServices?: ServiceSearchResult[];
}

export interface ServiceWithDetails {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  category: string | null;
  equipmentType: string | null;
  actionType: string | null;
  variables?: Array<{
    id: string;
    name: string;
    options: Array<{
      id: string;
      name: string;
      priceModifier: number;
    }>;
  }>;
  pricingTiers?: Array<{
    minQuantity: number;
    maxQuantity: number | null;
    pricePerUnit: number;
  }>;
}

class SemanticServiceService {
  /**
   * Obtém o serviço de embeddings baseado no provider configurado
   */
  private getEmbeddingService() {
    switch (SEMANTIC_CONFIG.EMBEDDING_PROVIDER) {
      case "openai":
        return openaiService;
      case "gemini":
        return geminiService;
      default:
        return openaiService;
    }
  }

  /**
   * Gera conteúdo textual rico para embedding de um serviço
   * Combina nome, descrição, categoria, tipo de equipamento e ação
   */
  private generateServiceContent(service: {
    name: string;
    description?: string | null;
    category?: string | null;
    equipmentType?: string | null;
    actionType?: string | null;
    variables?: Array<{ name: string; options: Array<{ name: string }> }>;
  }): string {
    const parts: string[] = [];

    // Nome do serviço (peso alto)
    parts.push(service.name);
    parts.push(service.name); // Duplicado para dar mais peso

    // Descrição
    if (service.description) {
      parts.push(service.description);
    }

    // Categoria
    if (service.category) {
      parts.push(`Categoria: ${service.category}`);
    }

    // Tipo de equipamento
    if (service.equipmentType) {
      parts.push(`Equipamento: ${service.equipmentType}`);
    }

    // Tipo de ação
    if (service.actionType) {
      parts.push(`Tipo: ${service.actionType}`);
    }

    // Variáveis e opções
    if (service.variables && service.variables.length > 0) {
      for (const variable of service.variables) {
        parts.push(variable.name);
        for (const option of variable.options) {
          parts.push(option.name);
        }
      }
    }

    return parts.join(" | ");
  }

  /**
   * Gera e armazena embedding para um serviço específico
   */
  async generateServiceEmbedding(serviceId: string): Promise<void> {
    try {
      console.log(`[SemanticService] Generating embedding for service ${serviceId}`);

      // Busca o serviço com todas as informações
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        include: {
          variables: {
            include: {
              options: true,
            },
          },
        },
      });

      if (!service) {
        console.warn(`[SemanticService] Service ${serviceId} not found`);
        return;
      }

      // Gera conteúdo textual rico
      const content = this.generateServiceContent({
        name: service.name,
        description: service.description,
        category: service.category,
        equipmentType: service.equipmentType,
        actionType: service.actionType,
        variables: service.variables.map((v) => ({
          name: v.name,
          options: v.options.map((o) => ({ name: o.name })),
        })),
      });

      console.log(`[SemanticService] Content for embedding: "${content.substring(0, 100)}..."`);

      // Gera embedding
      const embeddingService = this.getEmbeddingService();
      const embedding = await embeddingService.generateEmbedding(content);

      // Converte para formato pgvector
      const embeddingVector = `[${embedding.join(",")}]`;

      // Remove embedding antigo se existir
      await prisma.$executeRaw`
        DELETE FROM service_vectors WHERE service_id = ${serviceId}
      `;

      // Insere novo embedding
      await prisma.$executeRaw`
        INSERT INTO service_vectors (id, company_id, service_id, content, embedding, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${service.companyId},
          ${serviceId},
          ${content},
          ${embeddingVector}::vector,
          NOW(),
          NOW()
        )
      `;

      console.log(`[SemanticService] Embedding stored for service ${service.name}`);
    } catch (error: any) {
      console.error(`[SemanticService] Error generating embedding:`, error);
      throw error;
    }
  }

  /**
   * Expande query com sinônimos de domínio
   * Retorna array de termos expandidos para busca
   */
  async expandQueryWithSynonyms(companyId: string, query: string): Promise<string[]> {
    const queryLower = query.toLowerCase();
    const expandedTerms: Set<string> = new Set([query]);

    // Busca sinônimos específicos da empresa
    const companySynonyms = await prisma.domainSynonym.findMany({
      where: {
        OR: [
          { companyId },
          { companyId: null }, // Sinônimos globais
        ],
        isActive: true,
      },
    });

    // Combina com sinônimos padrão
    const allSynonyms = [
      ...companySynonyms.map((s) => ({
        canonicalTerm: s.canonicalTerm,
        synonyms: s.synonyms,
      })),
      ...DEFAULT_SYNONYMS,
    ];

    // Procura matches nos sinônimos
    for (const synonymGroup of allSynonyms) {
      const canonical = synonymGroup.canonicalTerm.toLowerCase();
      const syns = synonymGroup.synonyms.map((s) => s.toLowerCase());

      // Verifica se a query contém algum sinônimo ou termo canônico
      const allTerms = [canonical, ...syns];

      for (const term of allTerms) {
        if (queryLower.includes(term)) {
          // Adiciona todos os termos relacionados
          expandedTerms.add(canonical);
          syns.forEach((s) => expandedTerms.add(s));
        }
      }
    }

    const result = Array.from(expandedTerms);
    console.log(`[SemanticService] Query expansion: "${query}" -> [${result.join(", ")}]`);

    return result;
  }

  /**
   * Busca semântica principal
   * Combina busca vetorial com expansão de sinônimos
   */
  async searchServices(
    companyId: string,
    query: string,
    options: {
      threshold?: number;
      limit?: number;
      includeRelated?: boolean;
    } = {}
  ): Promise<ServiceSearchResult[]> {
    const {
      threshold = SEMANTIC_CONFIG.SIMILARITY_THRESHOLD,
      limit = SEMANTIC_CONFIG.DEFAULT_LIMIT,
      includeRelated = false,
    } = options;

    console.log(`[SemanticService] Searching services for: "${query}" (company: ${companyId})`);

    try {
      // 1. Expande query com sinônimos
      const expandedTerms = await this.expandQueryWithSynonyms(companyId, query);
      const expandedQuery = expandedTerms.join(" ");

      // 2. Gera embedding da query expandida
      const embeddingService = this.getEmbeddingService();
      const queryEmbedding = await embeddingService.generateEmbedding(expandedQuery);
      const queryVector = `[${queryEmbedding.join(",")}]`;

      // 3. Busca por similaridade vetorial
      const vectorResults = await prisma.$queryRaw<
        Array<{
          service_id: string;
          similarity: number;
        }>
      >`
        SELECT
          sv.service_id,
          1 - (sv.embedding <=> ${queryVector}::vector) as similarity
        FROM service_vectors sv
        INNER JOIN services s ON s.id = sv.service_id
        WHERE sv.company_id = ${companyId}
        AND s.is_active = true
        AND 1 - (sv.embedding <=> ${queryVector}::vector) >= ${threshold}
        ORDER BY sv.embedding <=> ${queryVector}::vector
        LIMIT ${limit}
      `;

      console.log(`[SemanticService] Vector search found ${vectorResults.length} results`);

      // 4. Se poucos resultados, tenta fallback lexical
      let lexicalResults: string[] = [];
      if (vectorResults.length < 2) {
        console.log(`[SemanticService] Few vector results, trying lexical fallback`);

        const lexicalQuery = `%${query}%`;
        const lexicalServices = await prisma.service.findMany({
          where: {
            companyId,
            isActive: true,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { category: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true },
          take: limit,
        });

        lexicalResults = lexicalServices.map((s) => s.id);
        console.log(`[SemanticService] Lexical fallback found ${lexicalResults.length} results`);
      }

      // 5. Combina IDs únicos
      const allServiceIds = new Set<string>();
      const similarityMap = new Map<string, number>();

      for (const result of vectorResults) {
        allServiceIds.add(result.service_id);
        similarityMap.set(result.service_id, Number(result.similarity));
      }

      for (const id of lexicalResults) {
        if (!allServiceIds.has(id)) {
          allServiceIds.add(id);
          similarityMap.set(id, 0.5); // Similaridade base para resultados lexicais
        }
      }

      if (allServiceIds.size === 0) {
        console.log(`[SemanticService] No results found for query: "${query}"`);
        return [];
      }

      // 6. Busca detalhes dos serviços
      const services = await prisma.service.findMany({
        where: {
          id: { in: Array.from(allServiceIds) },
        },
        include: {
          variables: {
            include: {
              options: true,
            },
          },
          pricingTiers: true,
        },
      });

      // 7. Formata resultados
      let results: ServiceSearchResult[] = services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        basePrice: Number(service.basePrice),
        category: service.category,
        equipmentType: service.equipmentType,
        actionType: service.actionType,
        similarity: similarityMap.get(service.id) || 0,
        matchedTerms: expandedTerms.filter((term) =>
          service.name.toLowerCase().includes(term.toLowerCase()) ||
          service.description?.toLowerCase().includes(term.toLowerCase())
        ),
      }));

      // Ordena por similaridade
      results.sort((a, b) => b.similarity - a.similarity);

      // 8. Adiciona serviços relacionados se solicitado
      if (includeRelated && results.length > 0) {
        for (const result of results) {
          const related = await this.findRelatedServices(result.id, 3);
          if (related.length > 0) {
            result.relatedServices = related.map((r) => ({
              id: r.id,
              name: r.name,
              description: r.description,
              basePrice: Number(r.basePrice),
              category: r.category,
              equipmentType: r.equipmentType,
              actionType: r.actionType,
              similarity: 0.8, // Similaridade padrão para relacionados
            }));
          }
        }
      }

      console.log(`[SemanticService] Returning ${results.length} results`);
      return results;
    } catch (error: any) {
      console.error(`[SemanticService] Error in searchServices:`, error);
      // Em caso de erro, tenta busca simples
      return this.fallbackSearch(companyId, query, limit);
    }
  }

  /**
   * Busca de fallback quando a busca semântica falha
   */
  private async fallbackSearch(
    companyId: string,
    query: string,
    limit: number
  ): Promise<ServiceSearchResult[]> {
    console.log(`[SemanticService] Using fallback search for: "${query}"`);

    const services = await prisma.service.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
        ],
      },
      take: limit,
    });

    return services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      basePrice: Number(service.basePrice),
      category: service.category,
      equipmentType: service.equipmentType,
      actionType: service.actionType,
      similarity: 0.5,
    }));
  }

  /**
   * Encontra serviços relacionados a um serviço específico
   */
  async findRelatedServices(
    serviceId: string,
    limit: number = 5
  ): Promise<ServiceWithDetails[]> {
    // Busca relacionamentos existentes
    const relationships = await prisma.$queryRaw<
      Array<{
        related_service_id: string;
        relationship_type: string;
        strength: number;
      }>
    >`
      SELECT related_service_id, relationship_type, strength
      FROM service_relationships
      WHERE source_service_id = ${serviceId}
      ORDER BY strength DESC
      LIMIT ${limit}
    `;

    if (relationships.length === 0) {
      return [];
    }

    const relatedIds = relationships.map((r) => r.related_service_id);

    const services = await prisma.service.findMany({
      where: {
        id: { in: relatedIds },
        isActive: true,
      },
      include: {
        variables: {
          include: {
            options: true,
          },
        },
        pricingTiers: true,
      },
    });

    return services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      basePrice: Number(service.basePrice),
      category: service.category,
      equipmentType: service.equipmentType,
      actionType: service.actionType,
      variables: service.variables.map((v) => ({
        id: v.id,
        name: v.name,
        options: v.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceModifier: Number(o.priceModifier),
        })),
      })),
      pricingTiers: service.pricingTiers.map((t) => ({
        minQuantity: t.minQuantity,
        maxQuantity: t.maxQuantity,
        pricePerUnit: Number(t.pricePerUnit),
      })),
    }));
  }

  /**
   * Detecta relacionamentos automaticamente entre serviços
   * Baseado em equipmentType, categoria e ações similares
   */
  async detectRelationships(companyId: string): Promise<{ created: number }> {
    console.log(`[SemanticService] Detecting relationships for company ${companyId}`);

    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
    });

    let created = 0;

    for (const source of services) {
      for (const target of services) {
        if (source.id === target.id) continue;

        let relationshipType: RelationshipType | null = null;
        let strength = 0;

        // Mesmo tipo de equipamento = same_equipment
        if (source.equipmentType && source.equipmentType === target.equipmentType) {
          relationshipType = "same_equipment";
          strength = 0.9;
        }
        // Mesma categoria, ação diferente = complement
        else if (
          source.category &&
          source.category === target.category &&
          source.actionType !== target.actionType
        ) {
          relationshipType = "complement";
          strength = 0.7;
        }
        // Mesma categoria, mesma ação, equipamento diferente = alternative
        else if (
          source.category &&
          source.category === target.category &&
          source.actionType === target.actionType &&
          source.equipmentType !== target.equipmentType
        ) {
          relationshipType = "alternative";
          strength = 0.6;
        }

        if (relationshipType) {
          // Tenta criar relacionamento (ignora se já existe)
          try {
            await prisma.$executeRaw`
              INSERT INTO service_relationships (
                id, company_id, source_service_id, related_service_id,
                relationship_type, strength, auto_detected, created_at
              )
              VALUES (
                gen_random_uuid(),
                ${companyId},
                ${source.id},
                ${target.id},
                ${relationshipType},
                ${strength},
                true,
                NOW()
              )
              ON CONFLICT (source_service_id, related_service_id) DO UPDATE
              SET relationship_type = ${relationshipType},
                  strength = ${strength},
                  auto_detected = true
            `;
            created++;
          } catch (error) {
            // Ignora erros de conflito
          }
        }
      }
    }

    console.log(`[SemanticService] Created/updated ${created} relationships`);
    return { created };
  }

  /**
   * Reindexa todos os serviços de uma empresa
   */
  async reindexCompanyServices(companyId: string): Promise<{ indexed: number }> {
    console.log(`[SemanticService] Reindexing services for company ${companyId}`);

    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });

    let indexed = 0;
    for (const service of services) {
      try {
        await this.generateServiceEmbedding(service.id);
        indexed++;
      } catch (error) {
        console.error(`[SemanticService] Error indexing service ${service.id}:`, error);
      }
    }

    // Também detecta relacionamentos
    await this.detectRelationships(companyId);

    console.log(`[SemanticService] Indexed ${indexed} of ${services.length} services`);
    return { indexed };
  }

  /**
   * Inicializa sinônimos padrão no banco de dados
   */
  async initializeDefaultSynonyms(): Promise<void> {
    console.log(`[SemanticService] Initializing default synonyms`);

    for (const synonym of DEFAULT_SYNONYMS) {
      try {
        // Verifica se já existe
        const existing = await prisma.domainSynonym.findFirst({
          where: {
            companyId: null,
            canonicalTerm: synonym.canonicalTerm,
          },
        });

        if (!existing) {
          await prisma.domainSynonym.create({
            data: {
              companyId: null,
              canonicalTerm: synonym.canonicalTerm,
              synonyms: synonym.synonyms,
              domain: synonym.domain,
              isActive: true,
            },
          });
          console.log(`[SemanticService] Created synonym: ${synonym.canonicalTerm}`);
        }
      } catch (error) {
        console.error(`[SemanticService] Error creating synonym ${synonym.canonicalTerm}:`, error);
      }
    }
  }

  /**
   * Obtém estatísticas de indexação de serviços
   */
  async getStats(companyId: string): Promise<{
    totalServices: number;
    indexedServices: number;
    totalRelationships: number;
    totalSynonyms: number;
  }> {
    const [totalServices, indexedServices, totalRelationships, totalSynonyms] = await Promise.all([
      prisma.service.count({ where: { companyId, isActive: true } }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT service_id) as count
        FROM service_vectors
        WHERE company_id = ${companyId}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM service_relationships
        WHERE company_id = ${companyId}
      `,
      prisma.domainSynonym.count({
        where: {
          OR: [{ companyId }, { companyId: null }],
          isActive: true,
        },
      }),
    ]);

    return {
      totalServices,
      indexedServices: Number(indexedServices[0]?.count || 0),
      totalRelationships: Number(totalRelationships[0]?.count || 0),
      totalSynonyms,
    };
  }
}

export const semanticServiceService = new SemanticServiceService();
export default semanticServiceService;
