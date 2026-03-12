import { prisma } from '../utils/prisma';

export class CustomerAddressService {
  async getAll(customerId: string, companyId: string) {
    return prisma.customerAddress.findMany({
      where: { customerId, companyId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getById(customerId: string, addressId: string, companyId: string) {
    return prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, companyId },
    });
  }

  async create(customerId: string, companyId: string, data: {
    label: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, companyId },
        data: { isDefault: false },
      });
    }
    return prisma.customerAddress.create({
      data: {
        customerId,
        companyId,
        label: data.label,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async update(customerId: string, addressId: string, companyId: string, data: {
    label?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId, companyId },
        data: { isDefault: false },
      });
    }
    return prisma.customerAddress.updateMany({
      where: { id: addressId, customerId, companyId },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.number !== undefined && { number: data.number }),
        ...(data.complement !== undefined && { complement: data.complement }),
        ...(data.neighborhood !== undefined && { neighborhood: data.neighborhood }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
  }

  async delete(customerId: string, addressId: string, companyId: string) {
    return prisma.customerAddress.deleteMany({
      where: { id: addressId, customerId, companyId },
    });
  }

  async setDefault(customerId: string, addressId: string, companyId: string) {
    await prisma.customerAddress.updateMany({
      where: { customerId, companyId },
      data: { isDefault: false },
    });
    return prisma.customerAddress.updateMany({
      where: { id: addressId, customerId, companyId },
      data: { isDefault: true },
    });
  }
}

export const customerAddressService = new CustomerAddressService();
