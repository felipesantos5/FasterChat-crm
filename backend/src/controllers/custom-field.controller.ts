import { Request, Response } from "express";
import { z, ZodError } from "zod";
import { customFieldService } from "../services/custom-field.service";

const createSchema = z.object({
  label: z.string().min(1, "Label obrigatório"),
  name: z.string().min(1, "Nome interno obrigatório").regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e underscores"),
  type: z.enum(["text", "number", "date"], { message: "Tipo inválido" }),
  required: z.boolean().optional(),
  order: z.number().int().optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  required: z.boolean().optional(),
  order: z.number().int().optional(),
});

class CustomFieldController {
  async getDefinitions(req: Request, res: Response): Promise<void> {
    try {
      const definitions = await customFieldService.getDefinitions();
      res.json({ success: true, data: definitions });
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro interno do servidor" });
    }
  }

  async createDefinition(req: Request, res: Response): Promise<void> {
    try {
      const data = createSchema.parse(req.body);
      const definition = await customFieldService.createDefinition(data);
      res.status(201).json({ success: true, data: definition });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Dados inválidos", errors: error.errors });
        return;
      }
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        res.status(400).json({ success: false, message: "Nome interno já está em uso" });
        return;
      }
      res.status(500).json({ success: false, message: "Erro interno do servidor" });
    }
  }

  async updateDefinition(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);
      const definition = await customFieldService.updateDefinition(id, data);
      res.json({ success: true, data: definition });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ success: false, message: "Dados inválidos", errors: error.errors });
        return;
      }
      res.status(500).json({ success: false, message: "Erro interno do servidor" });
    }
  }

  async deleteDefinition(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await customFieldService.deleteDefinition(id);
      res.json({ success: true, message: "Campo excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro interno do servidor" });
    }
  }
}

export const customFieldController = new CustomFieldController();
