import { prisma } from "../utils/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ServiceType } from "@prisma/client";

interface CreateServiceDTO {
  name: string;
  description?: string;
  basePrice: number;
  type?: ServiceType;
  category?: string;
  isActive?: boolean;
}

interface UpdateServiceDTO {
  name?: string;
  description?: string;
  basePrice?: number;
  type?: ServiceType;
  category?: string;
  isActive?: boolean;
  order?: number;
}

interface CreateVariableDTO {
  name: string;
  description?: string;
  isRequired?: boolean;
  order?: number;
  options?: CreateOptionDTO[];
}

interface UpdateVariableDTO {
  name?: string;
  description?: string;
  isRequired?: boolean;
  order?: number;
}

interface CreateOptionDTO {
  name: string;
  priceModifier: number;
  order?: number;
}

interface UpdateOptionDTO {
  name?: string;
  priceModifier?: number;
  order?: number;
}

export const serviceService = {
  // ==================== SERVICES ====================

  async listServices(companyId: string) {
    return prisma.service.findMany({
      where: { companyId },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });
  },

  async getService(id: string, companyId: string) {
    return prisma.service.findFirst({
      where: { id, companyId },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async createService(companyId: string, data: CreateServiceDTO) {
    const lastService = await prisma.service.findFirst({
      where: { companyId },
      orderBy: { order: "desc" },
    });

    return prisma.service.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        basePrice: new Decimal(data.basePrice),
        type: data.type ?? "SERVICE",
        category: data.category,
        isActive: data.isActive ?? true,
        order: (lastService?.order ?? -1) + 1,
      },
      include: {
        variables: {
          include: {
            options: true,
          },
        },
      },
    });
  },

  async updateService(id: string, companyId: string, data: UpdateServiceDTO) {
    const service = await prisma.service.findFirst({
      where: { id, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    return prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        basePrice: data.basePrice !== undefined ? new Decimal(data.basePrice) : undefined,
        type: data.type,
        category: data.category,
        isActive: data.isActive,
        order: data.order,
      },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async deleteService(id: string, companyId: string) {
    const service = await prisma.service.findFirst({
      where: { id, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    return prisma.service.delete({
      where: { id },
    });
  },

  async reorderServices(companyId: string, serviceIds: string[]) {
    const updates = serviceIds.map((id, index) =>
      prisma.service.updateMany({
        where: { id, companyId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
    return this.listServices(companyId);
  },

  // ==================== VARIABLES ====================

  async createVariable(serviceId: string, companyId: string, data: CreateVariableDTO) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    const lastVariable = await prisma.serviceVariable.findFirst({
      where: { serviceId },
      orderBy: { order: "desc" },
    });

    const variable = await prisma.serviceVariable.create({
      data: {
        serviceId,
        name: data.name,
        description: data.description,
        isRequired: data.isRequired ?? true,
        order: data.order ?? (lastVariable?.order ?? -1) + 1,
      },
    });

    // Criar opções se fornecidas
    if (data.options && data.options.length > 0) {
      await prisma.serviceVariableOption.createMany({
        data: data.options.map((opt, index) => ({
          variableId: variable.id,
          name: opt.name,
          priceModifier: new Decimal(opt.priceModifier),
          order: opt.order ?? index,
        })),
      });
    }

    return prisma.serviceVariable.findUnique({
      where: { id: variable.id },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async updateVariable(variableId: string, companyId: string, data: UpdateVariableDTO) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    return prisma.serviceVariable.update({
      where: { id: variableId },
      data: {
        name: data.name,
        description: data.description,
        isRequired: data.isRequired,
        order: data.order,
      },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
    });
  },

  async deleteVariable(variableId: string, companyId: string) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    return prisma.serviceVariable.delete({
      where: { id: variableId },
    });
  },

  async reorderVariables(serviceId: string, companyId: string, variableIds: string[]) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, companyId },
    });

    if (!service) {
      throw new Error("Serviço não encontrado");
    }

    const updates = variableIds.map((id, index) =>
      prisma.serviceVariable.updateMany({
        where: { id, serviceId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
  },

  // ==================== OPTIONS ====================

  async createOption(variableId: string, companyId: string, data: CreateOptionDTO) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    const lastOption = await prisma.serviceVariableOption.findFirst({
      where: { variableId },
      orderBy: { order: "desc" },
    });

    return prisma.serviceVariableOption.create({
      data: {
        variableId,
        name: data.name,
        priceModifier: new Decimal(data.priceModifier),
        order: data.order ?? (lastOption?.order ?? -1) + 1,
      },
    });
  },

  async updateOption(optionId: string, companyId: string, data: UpdateOptionDTO) {
    const option = await prisma.serviceVariableOption.findFirst({
      where: {
        id: optionId,
        variable: {
          service: { companyId },
        },
      },
    });

    if (!option) {
      throw new Error("Opção não encontrada");
    }

    return prisma.serviceVariableOption.update({
      where: { id: optionId },
      data: {
        name: data.name,
        priceModifier: data.priceModifier !== undefined ? new Decimal(data.priceModifier) : undefined,
        order: data.order,
      },
    });
  },

  async deleteOption(optionId: string, companyId: string) {
    const option = await prisma.serviceVariableOption.findFirst({
      where: {
        id: optionId,
        variable: {
          service: { companyId },
        },
      },
    });

    if (!option) {
      throw new Error("Opção não encontrada");
    }

    return prisma.serviceVariableOption.delete({
      where: { id: optionId },
    });
  },

  async reorderOptions(variableId: string, companyId: string, optionIds: string[]) {
    const variable = await prisma.serviceVariable.findFirst({
      where: {
        id: variableId,
        service: { companyId },
      },
    });

    if (!variable) {
      throw new Error("Variável não encontrada");
    }

    const updates = optionIds.map((id, index) =>
      prisma.serviceVariableOption.updateMany({
        where: { id, variableId },
        data: { order: index },
      })
    );

    await prisma.$transaction(updates);
  },

  // ==================== BULK OPERATIONS ====================

  async saveServiceComplete(
    companyId: string,
    serviceData: {
      id?: string;
      name: string;
      description?: string;
      basePrice: number;
      type?: ServiceType;
      category?: string;
      isActive?: boolean;
      variables: {
        id?: string;
        name: string;
        description?: string;
        isRequired?: boolean;
        options: {
          id?: string;
          name: string;
          priceModifier: number;
        }[];
      }[];
    }
  ) {
    // Se tem ID, é update, senão é create
    if (serviceData.id) {
      // Verificar se pertence à empresa
      const existing = await prisma.service.findFirst({
        where: { id: serviceData.id, companyId },
      });

      if (!existing) {
        throw new Error("Serviço não encontrado");
      }

      // Update service
      const service = await prisma.service.update({
        where: { id: serviceData.id },
        data: {
          name: serviceData.name,
          description: serviceData.description,
          basePrice: new Decimal(serviceData.basePrice),
          type: serviceData.type ?? "SERVICE",
          category: serviceData.category,
          isActive: serviceData.isActive ?? true,
        },
      });

      // Deletar variáveis e opções antigas
      await prisma.serviceVariable.deleteMany({
        where: { serviceId: service.id },
      });

      // Recriar variáveis e opções
      for (let vIndex = 0; vIndex < serviceData.variables.length; vIndex++) {
        const varData = serviceData.variables[vIndex];
        const variable = await prisma.serviceVariable.create({
          data: {
            serviceId: service.id,
            name: varData.name,
            description: varData.description,
            isRequired: varData.isRequired ?? true,
            order: vIndex,
          },
        });

        if (varData.options.length > 0) {
          await prisma.serviceVariableOption.createMany({
            data: varData.options.map((opt, oIndex) => ({
              variableId: variable.id,
              name: opt.name,
              priceModifier: new Decimal(opt.priceModifier),
              order: oIndex,
            })),
          });
        }
      }

      return this.getService(service.id, companyId);
    } else {
      // Create new service
      const lastService = await prisma.service.findFirst({
        where: { companyId },
        orderBy: { order: "desc" },
      });

      const service = await prisma.service.create({
        data: {
          companyId,
          name: serviceData.name,
          description: serviceData.description,
          basePrice: new Decimal(serviceData.basePrice),
          type: serviceData.type ?? "SERVICE",
          category: serviceData.category,
          isActive: serviceData.isActive ?? true,
          order: (lastService?.order ?? -1) + 1,
        },
      });

      // Criar variáveis e opções
      for (let vIndex = 0; vIndex < serviceData.variables.length; vIndex++) {
        const varData = serviceData.variables[vIndex];
        const variable = await prisma.serviceVariable.create({
          data: {
            serviceId: service.id,
            name: varData.name,
            description: varData.description,
            isRequired: varData.isRequired ?? true,
            order: vIndex,
          },
        });

        if (varData.options.length > 0) {
          await prisma.serviceVariableOption.createMany({
            data: varData.options.map((opt, oIndex) => ({
              variableId: variable.id,
              name: opt.name,
              priceModifier: new Decimal(opt.priceModifier),
              order: oIndex,
            })),
          });
        }
      }

      return this.getService(service.id, companyId);
    }
  },

  // ==================== GET SERVICES FOR AI ====================

  async getServicesForAI(companyId: string) {
    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
      include: {
        variables: {
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    // Formatar para a IA entender facilmente
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      basePrice: Number(service.basePrice),
      type: service.type,
      category: service.category,
      variables: service.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        description: variable.description,
        isRequired: variable.isRequired,
        options: variable.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceModifier: Number(option.priceModifier),
        })),
      })),
    }));
  },
};
