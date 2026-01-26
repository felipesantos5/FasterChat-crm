/**
 * ============================================
 * SECTIONS - Seções Reutilizáveis do Prompt
 * ============================================
 *
 * Seções modulares que podem ser incluídas conforme necessidade:
 * - tools: Ferramentas disponíveis (function calling)
 * - style: Estilo de resposta e tom
 * - transbordo: Transferência para humano
 * - services: Formatação de serviços/produtos
 * - knowledge: FAQ, RAG, feedback learning
 */

export * from "./tools";
export * from "./style";
export * from "./transbordo";
export * from "./services";
export * from "./knowledge";
