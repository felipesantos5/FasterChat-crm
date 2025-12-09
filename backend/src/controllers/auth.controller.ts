import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { validateSignup, validateLogin } from "../utils/validation";
import { ZodError } from "zod";
import { prisma } from "@/utils/prisma";

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validatedData = validateSignup(req.body);

      // Create user and company
      const result = await authService.signup(validatedData);

      res.status(201).json({
        success: true,
        message: "Usuário criado com sucesso",
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
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
        message: "Erro interno do servidor",
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const validatedData = validateLogin(req.body);

      // Authenticate user
      const result = await authService.login(validatedData);

      res.status(200).json({
        success: true,
        message: "Login realizado com sucesso",
        data: result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
        return;
      }

      if (error instanceof Error) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
      });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
        return;
      }

      const user = await authService.getUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
      });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: "Refresh token não fornecido",
        });
        return;
      }

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: "Token renovado com sucesso",
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(401).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
      });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { name, email, companyName } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, message: "Não autenticado" });
        return;
      }

      // Atualiza usuário e empresa em uma transação
      const updatedUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { name, email },
        });

        if (companyName && user.companyId) {
          await tx.company.update({
            where: { id: user.companyId },
            data: { name: companyName },
          });
        }

        return user;
      });

      res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ success: false, message: "Erro ao atualizar perfil" });
    }
  }
}

export const authController = new AuthController();
