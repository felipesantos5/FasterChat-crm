import { prisma } from '../utils/prisma';

class TagService {
  /**
   * Busca todas as tags de uma empresa
   */
  async findAll(companyId: string) {
    try {
      const tags = await prisma.tag.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
      });

      return tags;
    } catch (error: any) {
      console.error('Error finding tags:', error);
      throw new Error(`Failed to find tags: ${error.message}`);
    }
  }

  /**
   * Busca apenas os nomes das tags de uma empresa
   */
  async findAllNames(companyId: string): Promise<string[]> {
    try {
      console.log('[Tag Service] findAllNames for company:', companyId);
      const tags = await this.findAll(companyId);
      console.log('[Tag Service] Found tags:', tags.length);
      const names = tags.map((tag) => tag.name);
      console.log('[Tag Service] Returning tag names:', names);
      return names;
    } catch (error: any) {
      console.error('[Tag Service] Error finding tag names:', error);
      throw new Error(`Failed to find tag names: ${error.message}`);
    }
  }

  /**
   * Cria ou retorna uma tag existente
   */
  async createOrGet(companyId: string, name: string, color?: string) {
    try {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error('Tag name cannot be empty');
      }

      // Tenta criar, mas se já existir, apenas retorna
      const tag = await prisma.tag.upsert({
        where: {
          companyId_name: {
            companyId,
            name: trimmedName,
          },
        },
        update: {
          // Se já existe, atualiza a cor se fornecida
          ...(color && { color }),
        },
        create: {
          companyId,
          name: trimmedName,
          color: color || '#8B5CF6',
        },
      });

      return tag;
    } catch (error: any) {
      console.error('Error creating/getting tag:', error);
      throw new Error(`Failed to create/get tag: ${error.message}`);
    }
  }

  /**
   * Cria ou retorna várias tags de uma vez
   */
  async createOrGetMany(companyId: string, names: string[]) {
    try {
      console.log('[Tag Service] Creating/getting tags:', { companyId, names });
      const tags = await Promise.all(
        names.map((name) => this.createOrGet(companyId, name))
      );

      console.log('[Tag Service] Tags created/retrieved:', tags.map(t => t.name));
      return tags;
    } catch (error: any) {
      console.error('Error creating/getting tags:', error);
      throw new Error(`Failed to create/get tags: ${error.message}`);
    }
  }

  /**
   * Deleta uma tag (apenas se não estiver sendo usada)
   */
  async delete(id: string) {
    try {
      // Verifica se a tag está sendo usada em algum cliente
      const tag = await prisma.tag.findUnique({
        where: { id },
      });

      if (!tag) {
        throw new Error('Tag not found');
      }

      // Verifica se algum cliente usa essa tag
      const customersUsingTag = await prisma.customer.count({
        where: {
          companyId: tag.companyId,
          tags: {
            has: tag.name,
          },
        },
      });

      if (customersUsingTag > 0) {
        throw new Error(
          `Cannot delete tag. ${customersUsingTag} customer(s) are using this tag`
        );
      }

      await prisma.tag.delete({
        where: { id },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting tag:', error);
      throw new Error(`Failed to delete tag: ${error.message}`);
    }
  }

  /**
   * Sincroniza tags do sistema com as tags usadas nos clientes
   * (Garante que toda tag usada em um cliente esteja cadastrada no sistema)
   */
  async syncFromCustomers(companyId: string) {
    try {
      // Busca todos os clientes da empresa
      const customers = await prisma.customer.findMany({
        where: { companyId },
        select: { tags: true },
      });

      // Extrai todas as tags únicas
      const allTags = new Set<string>();
      customers.forEach((customer) => {
        customer.tags.forEach((tag) => allTags.add(tag));
      });

      // Cria ou atualiza todas as tags
      await this.createOrGetMany(companyId, Array.from(allTags));

      return { success: true, tagsCount: allTags.size };
    } catch (error: any) {
      console.error('Error syncing tags from customers:', error);
      throw new Error(`Failed to sync tags: ${error.message}`);
    }
  }
}

export default new TagService();
