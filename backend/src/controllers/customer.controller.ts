import { Request, Response } from 'express';
import { customerService } from '../services/customer.service';
import {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateCustomerFilters,
} from '../utils/validation.customer';
import { ZodError } from 'zod';

export class CustomerController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const validatedData = validateCreateCustomer(req.body);
      const customer = await customerService.create(req.user.companyId, validatedData);

      res.status(201).json({
        success: true,
        message: 'Cliente criado com sucesso',
        data: customer,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async findAll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const filters = validateCustomerFilters(req.query);
      const result = await customerService.findAll(req.user.companyId, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Filtros inválidos',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const { id } = req.params;
      const customer = await customerService.findById(id, req.user.companyId);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Cliente não encontrado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: customer,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const { id } = req.params;
      const validatedData = validateUpdateCustomer(req.body);
      const customer = await customerService.update(
        id,
        req.user.companyId,
        validatedData
      );

      res.status(200).json({
        success: true,
        message: 'Cliente atualizado com sucesso',
        data: customer,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const { id } = req.params;
      await customerService.delete(id, req.user.companyId);

      res.status(200).json({
        success: true,
        message: 'Cliente excluído com sucesso',
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const stats = await customerService.getStats(req.user.companyId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  async getAllTags(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
        });
        return;
      }

      const tags = await customerService.getAllTags(req.user.companyId);

      res.status(200).json({
        success: true,
        data: tags,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }
}

export const customerController = new CustomerController();
