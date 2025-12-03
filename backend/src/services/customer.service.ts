import { Customer } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { CreateCustomerDTO, UpdateCustomerDTO, CustomerFilters } from '../types/customer';
import tagService from './tag.service';

export class CustomerService {
  async create(companyId: string, data: CreateCustomerDTO): Promise<Customer> {
    // Check if phone already exists for this company
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        companyId_phone: {
          companyId,
          phone: data.phone,
        },
      },
    });

    if (existingCustomer) {
      throw new Error('Telefone já cadastrado para esta empresa');
    }

    // Salva automaticamente as tags no sistema
    if (data.tags && data.tags.length > 0) {
      console.log('[Customer Service] Saving tags for customer:', data.tags);
      await tagService.createOrGetMany(companyId, data.tags);
    }

    // Detecta automaticamente se é um grupo do WhatsApp
    // Grupos do WhatsApp sempre contêm "@g.us" no número
    const isGroup = data.phone.includes('@g.us');

    console.log('[Customer Service] Creating customer with data:', {
      companyId,
      name: data.name,
      tags: data.tags,
      isGroup
    });

    return prisma.customer.create({
      data: {
        ...data,
        companyId,
        email: data.email || null,
        tags: data.tags || [],
        notes: data.notes || null,
        isGroup,
      },
    });
  }

  async findAll(
    companyId: string,
    filters: CustomerFilters
  ): Promise<{ customers: Customer[]; total: number; page: number; limit: number }> {
    const { search, tags, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasSome: tags,
      };
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      customers,
      total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<Customer | null> {
    return prisma.customer.findFirst({
      where: {
        id,
        companyId,
      },
    });
  }

  async update(
    id: string,
    companyId: string,
    data: UpdateCustomerDTO
  ): Promise<Customer> {
    // Check if customer exists and belongs to company
    const customer = await this.findById(id, companyId);
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    // If updating phone, check if it's already in use
    if (data.phone && data.phone !== customer.phone) {
      const existingCustomer = await prisma.customer.findUnique({
        where: {
          companyId_phone: {
            companyId,
            phone: data.phone,
          },
        },
      });

      if (existingCustomer) {
        throw new Error('Telefone já cadastrado para esta empresa');
      }
    }

    // Salva automaticamente as tags no sistema quando atualizar
    if (data.tags && data.tags.length > 0) {
      await tagService.createOrGetMany(companyId, data.tags);
    }

    return prisma.customer.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    });
  }

  async delete(id: string, companyId: string): Promise<void> {
    // Check if customer exists and belongs to company
    const customer = await this.findById(id, companyId);
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    await prisma.customer.delete({
      where: { id },
    });
  }

  async getStats(companyId: string): Promise<{
    total: number;
    thisMonth: number;
    tags: { tag: string; count: number }[];
  }> {
    const total = await prisma.customer.count({
      where: { companyId },
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonth = await prisma.customer.count({
      where: {
        companyId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // Get all customers to count tags
    const customers = await prisma.customer.findMany({
      where: { companyId },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    customers.forEach((customer) => {
      customer.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      thisMonth,
      tags,
    };
  }

  async getAllTags(companyId: string): Promise<string[]> {
    const customers = await prisma.customer.findMany({
      where: { companyId },
      select: { tags: true },
    });

    const allTags = new Set<string>();
    customers.forEach((customer) => {
      customer.tags.forEach((tag) => allTags.add(tag));
    });

    return Array.from(allTags).sort();
  }
}

export const customerService = new CustomerService();
