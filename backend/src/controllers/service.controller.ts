import { Request, Response } from "express";
import { serviceService } from "../services/service.service";

export const serviceController = {
  // ==================== SERVICES ====================

  async listServices(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const services = await serviceService.listServices(companyId);
      return res.json(services);
    } catch (error) {
      console.error("Erro ao listar serviços:", error);
      return res.status(500).json({ error: "Erro ao listar serviços" });
    }
  },

  async getService(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;

      const service = await serviceService.getService(id, companyId);

      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      return res.json(service);
    } catch (error) {
      console.error("Erro ao buscar serviço:", error);
      return res.status(500).json({ error: "Erro ao buscar serviço" });
    }
  },

  async createService(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { name, description, basePrice, isActive } = req.body;

      if (!name || basePrice === undefined) {
        return res.status(400).json({ error: "Nome e preço base são obrigatórios" });
      }

      const service = await serviceService.createService(companyId, {
        name,
        description,
        basePrice,
        isActive,
      });

      return res.status(201).json(service);
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      return res.status(500).json({ error: "Erro ao criar serviço" });
    }
  },

  async updateService(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const { name, description, basePrice, isActive, order } = req.body;

      const service = await serviceService.updateService(id, companyId, {
        name,
        description,
        basePrice,
        isActive,
        order,
      });

      return res.json(service);
    } catch (error: any) {
      console.error("Erro ao atualizar serviço:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar serviço" });
    }
  },

  async deleteService(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;

      await serviceService.deleteService(id, companyId);

      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar serviço:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar serviço" });
    }
  },

  async reorderServices(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { serviceIds } = req.body;

      if (!Array.isArray(serviceIds)) {
        return res.status(400).json({ error: "serviceIds deve ser um array" });
      }

      const services = await serviceService.reorderServices(companyId, serviceIds);

      return res.json(services);
    } catch (error) {
      console.error("Erro ao reordenar serviços:", error);
      return res.status(500).json({ error: "Erro ao reordenar serviços" });
    }
  },

  // ==================== VARIABLES ====================

  async createVariable(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { serviceId } = req.params;
      const { name, description, isRequired, options } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const variable = await serviceService.createVariable(serviceId, companyId, {
        name,
        description,
        isRequired,
        options,
      });

      return res.status(201).json(variable);
    } catch (error: any) {
      console.error("Erro ao criar variável:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao criar variável" });
    }
  },

  async updateVariable(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { variableId } = req.params;
      const { name, description, isRequired, order } = req.body;

      const variable = await serviceService.updateVariable(variableId, companyId, {
        name,
        description,
        isRequired,
        order,
      });

      return res.json(variable);
    } catch (error: any) {
      console.error("Erro ao atualizar variável:", error);
      if (error.message === "Variável não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar variável" });
    }
  },

  async deleteVariable(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { variableId } = req.params;

      await serviceService.deleteVariable(variableId, companyId);

      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar variável:", error);
      if (error.message === "Variável não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar variável" });
    }
  },

  // ==================== OPTIONS ====================

  async createOption(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { variableId } = req.params;
      const { name, priceModifier } = req.body;

      if (!name || priceModifier === undefined) {
        return res.status(400).json({ error: "Nome e modificador de preço são obrigatórios" });
      }

      const option = await serviceService.createOption(variableId, companyId, {
        name,
        priceModifier,
      });

      return res.status(201).json(option);
    } catch (error: any) {
      console.error("Erro ao criar opção:", error);
      if (error.message === "Variável não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao criar opção" });
    }
  },

  async updateOption(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { optionId } = req.params;
      const { name, priceModifier, order } = req.body;

      const option = await serviceService.updateOption(optionId, companyId, {
        name,
        priceModifier,
        order,
      });

      return res.json(option);
    } catch (error: any) {
      console.error("Erro ao atualizar opção:", error);
      if (error.message === "Opção não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar opção" });
    }
  },

  async deleteOption(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { optionId } = req.params;

      await serviceService.deleteOption(optionId, companyId);

      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar opção:", error);
      if (error.message === "Opção não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar opção" });
    }
  },

  // ==================== BULK OPERATIONS ====================

  async saveServiceComplete(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const serviceData = req.body;

      if (!serviceData.name || serviceData.basePrice === undefined) {
        return res.status(400).json({ error: "Nome e preço base são obrigatórios" });
      }

      const service = await serviceService.saveServiceComplete(companyId, serviceData);

      return res.json(service);
    } catch (error: any) {
      console.error("Erro ao salvar serviço:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao salvar serviço" });
    }
  },

  // ==================== AI ====================

  async getServicesForAI(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const services = await serviceService.getServicesForAI(companyId);
      return res.json(services);
    } catch (error) {
      console.error("Erro ao buscar serviços para IA:", error);
      return res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  },
};
