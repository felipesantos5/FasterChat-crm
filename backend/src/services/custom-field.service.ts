import { prisma } from "../utils/prisma";

export interface CreateFieldDTO {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  order?: number;
}

export interface UpdateFieldDTO {
  label?: string;
  required?: boolean;
  order?: number;
}

export interface FieldValueDTO {
  fieldId: string;
  value: string | null;
}

export class CustomFieldService {
  async getDefinitions() {
    return prisma.customFieldDefinition.findMany({
      orderBy: { order: "asc" },
    });
  }

  async createDefinition(data: CreateFieldDTO) {
    return prisma.customFieldDefinition.create({
      data: {
        label: data.label,
        name: data.name,
        type: data.type,
        required: data.required ?? false,
        order: data.order ?? 0,
      },
    });
  }

  async updateDefinition(id: string, data: UpdateFieldDTO) {
    return prisma.customFieldDefinition.update({
      where: { id },
      data,
    });
  }

  async deleteDefinition(id: string) {
    await prisma.customFieldDefinition.delete({ where: { id } });
  }

  async upsertCustomerValues(customerId: string, values: FieldValueDTO[]) {
    for (const { fieldId, value } of values) {
      await prisma.customerCustomFieldValue.upsert({
        where: { customerId_fieldId: { customerId, fieldId } },
        update: { value },
        create: { customerId, fieldId, value },
      });
    }
  }
}

export const customFieldService = new CustomFieldService();
