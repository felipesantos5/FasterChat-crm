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

  async getCompletePricingForAI(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const pricing = await serviceService.getCompletePricingForAI(companyId);
      return res.json(pricing);
    } catch (error) {
      console.error("Erro ao buscar precificação completa:", error);
      return res.status(500).json({ error: "Erro ao buscar precificação" });
    }
  },

  // ==================== ZONES ====================

  async listZones(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const zones = await serviceService.listZones(companyId);
      return res.json(zones);
    } catch (error) {
      console.error("Erro ao listar zonas:", error);
      return res.status(500).json({ error: "Erro ao listar zonas" });
    }
  },

  async getZone(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const zone = await serviceService.getZone(id, companyId);
      if (!zone) {
        return res.status(404).json({ error: "Zona não encontrada" });
      }
      return res.json(zone);
    } catch (error) {
      console.error("Erro ao buscar zona:", error);
      return res.status(500).json({ error: "Erro ao buscar zona" });
    }
  },

  async createZone(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { name, description, pricingType, priceModifier, neighborhoods, isDefault, requiresQuote, isActive } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const zone = await serviceService.createZone(companyId, {
        name,
        description,
        pricingType,
        priceModifier,
        neighborhoods,
        isDefault,
        requiresQuote,
        isActive,
      });

      return res.status(201).json(zone);
    } catch (error) {
      console.error("Erro ao criar zona:", error);
      return res.status(500).json({ error: "Erro ao criar zona" });
    }
  },

  async updateZone(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const { name, description, pricingType, priceModifier, neighborhoods, isDefault, requiresQuote, isActive, order } = req.body;

      const zone = await serviceService.updateZone(id, companyId, {
        name,
        description,
        pricingType,
        priceModifier,
        neighborhoods,
        isDefault,
        requiresQuote,
        isActive,
        order,
      });

      return res.json(zone);
    } catch (error: any) {
      console.error("Erro ao atualizar zona:", error);
      if (error.message === "Zona não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar zona" });
    }
  },

  async deleteZone(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      await serviceService.deleteZone(id, companyId);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar zona:", error);
      if (error.message === "Zona não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar zona" });
    }
  },

  // ==================== PRICING TIERS ====================

  async listPricingTiers(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { serviceId } = req.params;
      const tiers = await serviceService.listPricingTiers(serviceId, companyId);
      return res.json(tiers);
    } catch (error: any) {
      console.error("Erro ao listar faixas de preço:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao listar faixas de preço" });
    }
  },

  async setPricingTiers(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { serviceId } = req.params;
      const { tiers } = req.body;

      if (!Array.isArray(tiers)) {
        return res.status(400).json({ error: "tiers deve ser um array" });
      }

      const result = await serviceService.setPricingTiers(serviceId, companyId, tiers);
      return res.json(result);
    } catch (error: any) {
      console.error("Erro ao definir faixas de preço:", error);
      if (error.message === "Serviço não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao definir faixas de preço" });
    }
  },

  // ==================== COMBOS ====================

  async listCombos(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const combos = await serviceService.listCombos(companyId);
      return res.json(combos);
    } catch (error) {
      console.error("Erro ao listar combos:", error);
      return res.status(500).json({ error: "Erro ao listar combos" });
    }
  },

  async getCombo(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const combo = await serviceService.getCombo(id, companyId);
      if (!combo) {
        return res.status(404).json({ error: "Combo não encontrado" });
      }
      return res.json(combo);
    } catch (error) {
      console.error("Erro ao buscar combo:", error);
      return res.status(500).json({ error: "Erro ao buscar combo" });
    }
  },

  async createCombo(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { name, description, fixedPrice, category, isActive, items } = req.body;

      if (!name || fixedPrice === undefined) {
        return res.status(400).json({ error: "Nome e preço fixo são obrigatórios" });
      }

      const combo = await serviceService.createCombo(companyId, {
        name,
        description,
        fixedPrice,
        category,
        isActive,
        items,
      });

      return res.status(201).json(combo);
    } catch (error) {
      console.error("Erro ao criar combo:", error);
      return res.status(500).json({ error: "Erro ao criar combo" });
    }
  },

  async updateCombo(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const { name, description, fixedPrice, category, isActive, order } = req.body;

      const combo = await serviceService.updateCombo(id, companyId, {
        name,
        description,
        fixedPrice,
        category,
        isActive,
        order,
      });

      return res.json(combo);
    } catch (error: any) {
      console.error("Erro ao atualizar combo:", error);
      if (error.message === "Combo não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar combo" });
    }
  },

  async deleteCombo(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      await serviceService.deleteCombo(id, companyId);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar combo:", error);
      if (error.message === "Combo não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar combo" });
    }
  },

  async setComboItems(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items deve ser um array" });
      }

      const combo = await serviceService.setComboItems(id, companyId, items);
      return res.json(combo);
    } catch (error: any) {
      console.error("Erro ao definir itens do combo:", error);
      if (error.message === "Combo não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao definir itens do combo" });
    }
  },

  // ==================== ADDITIONALS ====================

  async listAdditionals(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const additionals = await serviceService.listAdditionals(companyId);
      return res.json(additionals);
    } catch (error) {
      console.error("Erro ao listar adicionais:", error);
      return res.status(500).json({ error: "Erro ao listar adicionais" });
    }
  },

  async createAdditional(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { name, description, price, appliesToCategories, isActive } = req.body;

      if (!name || price === undefined) {
        return res.status(400).json({ error: "Nome e preço são obrigatórios" });
      }

      const additional = await serviceService.createAdditional(companyId, {
        name,
        description,
        price,
        appliesToCategories,
        isActive,
      });

      return res.status(201).json(additional);
    } catch (error) {
      console.error("Erro ao criar adicional:", error);
      return res.status(500).json({ error: "Erro ao criar adicional" });
    }
  },

  async updateAdditional(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      const { name, description, price, appliesToCategories, isActive, order } = req.body;

      const additional = await serviceService.updateAdditional(id, companyId, {
        name,
        description,
        price,
        appliesToCategories,
        isActive,
        order,
      });

      return res.json(additional);
    } catch (error: any) {
      console.error("Erro ao atualizar adicional:", error);
      if (error.message === "Adicional não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao atualizar adicional" });
    }
  },

  async deleteAdditional(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      await serviceService.deleteAdditional(id, companyId);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar adicional:", error);
      if (error.message === "Adicional não encontrado") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar adicional" });
    }
  },

  // ==================== ZONE EXCEPTIONS ====================

  async listZoneExceptions(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const exceptions = await serviceService.listZoneExceptions(companyId);
      return res.json(exceptions);
    } catch (error) {
      console.error("Erro ao listar exceções:", error);
      return res.status(500).json({ error: "Erro ao listar exceções" });
    }
  },

  async createZoneException(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { zoneId, serviceId, category, minQuantity, exceptionType, customFee, description, isActive } = req.body;

      if (!zoneId || !exceptionType) {
        return res.status(400).json({ error: "zoneId e exceptionType são obrigatórios" });
      }

      const exception = await serviceService.createZoneException(companyId, {
        zoneId,
        serviceId,
        category,
        minQuantity,
        exceptionType,
        customFee,
        description,
        isActive,
      });

      return res.status(201).json(exception);
    } catch (error) {
      console.error("Erro ao criar exceção:", error);
      return res.status(500).json({ error: "Erro ao criar exceção" });
    }
  },

  async deleteZoneException(req: Request, res: Response) {
    try {
      const { companyId } = req.user!;
      const { id } = req.params;
      await serviceService.deleteZoneException(id, companyId);
      return res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar exceção:", error);
      if (error.message === "Exceção não encontrada") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Erro ao deletar exceção" });
    }
  },
};
