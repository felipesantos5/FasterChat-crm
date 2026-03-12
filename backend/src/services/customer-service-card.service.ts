import { prisma } from '../utils/prisma';

export class CustomerServiceCardService {
  async getAll(customerId: string, companyId: string) {
    return prisma.customerServiceCard.findMany({
      where: { customerId, companyId },
      orderBy: { serviceDate: 'desc' },
    });
  }

  async getById(customerId: string, cardId: string, companyId: string) {
    return prisma.customerServiceCard.findFirst({
      where: { id: cardId, customerId, companyId },
    });
  }

  async create(customerId: string, companyId: string, data: {
    title: string;
    description: string;
    serviceDate: string;
    rating?: number;
    price?: number;
    status: string;
    tags?: string[];
  }) {
    return prisma.customerServiceCard.create({
      data: {
        customerId,
        companyId,
        title: data.title,
        description: data.description,
        serviceDate: new Date(data.serviceDate),
        rating: data.rating,
        price: data.price,
        status: data.status,
        tags: data.tags ?? [],
      },
    });
  }

  async update(customerId: string, cardId: string, companyId: string, data: {
    title?: string;
    description?: string;
    serviceDate?: string;
    rating?: number;
    price?: number;
    status?: string;
    tags?: string[];
  }) {
    return prisma.customerServiceCard.updateMany({
      where: { id: cardId, customerId, companyId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.serviceDate !== undefined && { serviceDate: new Date(data.serviceDate) }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });
  }

  async delete(customerId: string, cardId: string, companyId: string) {
    return prisma.customerServiceCard.deleteMany({
      where: { id: cardId, customerId, companyId },
    });
  }
}

export const customerServiceCardService = new CustomerServiceCardService();
