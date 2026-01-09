import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { adminService } from "../services/admin.service";

const ADMIN_JWT_SECRET = process.env.JWT_SECRET || "admin-secret-key";

export const adminController = {
  // Login do admin
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: "Username e password são obrigatórios",
        });
      }

      const isValid = adminService.validateCredentials(username, password);

      if (!isValid) {
        return res.status(401).json({
          error: "Credenciais inválidas",
        });
      }

      // Gerar token JWT para o admin
      const token = jwt.sign(
        {
          isAdmin: true,
          username: "admin",
        },
        ADMIN_JWT_SECRET,
        { expiresIn: "24h" }
      );

      return res.json({
        token,
        message: "Login realizado com sucesso",
      });
    } catch (error) {
      console.error("Erro no login admin:", error);
      return res.status(500).json({
        error: "Erro interno do servidor",
      });
    }
  },

  // Listar empresas
  async listCompanies(req: Request, res: Response) {
    try {
      const companies = await adminService.listCompanies();
      return res.json(companies);
    } catch (error) {
      console.error("Erro ao listar empresas:", error);
      return res.status(500).json({
        error: "Erro ao listar empresas",
      });
    }
  },

  // Estatísticas gerais
  async getStats(req: Request, res: Response) {
    try {
      const stats = await adminService.getStats();
      return res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      return res.status(500).json({
        error: "Erro ao buscar estatísticas",
      });
    }
  },

  // Seed de dados HVAC para cliente específico
  async seedHvacData(req: Request, res: Response) {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          error: "companyId é obrigatório",
        });
      }

      console.log(`🚀 Iniciando seed HVAC para empresa ${companyId}...`);

      const result = await adminService.seedHvacData(companyId);

      console.log(`✅ Seed HVAC concluído para ${result.companyName}`);
      console.log(`   - Serviços: ${result.results.services}`);
      console.log(`   - Faixas de preço: ${result.results.pricingTiers}`);
      console.log(`   - Zonas: ${result.results.zones}`);
      console.log(`   - Combos: ${result.results.combos}`);
      console.log(`   - Adicionais: ${result.results.additionals}`);
      console.log(`   - Exceções: ${result.results.exceptions}`);

      return res.json(result);
    } catch (error: any) {
      console.error("❌ Erro no seed HVAC:", error);
      return res.status(500).json({
        error: error.message || "Erro ao executar seed HVAC",
      });
    }
  },
};
