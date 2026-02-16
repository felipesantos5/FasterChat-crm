import { Request, Response } from "express";
import dashboardService from "../services/dashboard.service";

class DashboardController {
  /**
   * GET /api/dashboard/stats
   * Obtém estatísticas do dashboard com comparação temporal
   */
  async getStats(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const companyId = req.user.companyId;
      const preset = (req.query.preset as string) || "7days";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Company ID is required",
        });
      }

      const stats = await dashboardService.getDashboardStats(companyId, preset, startDate, endDate);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Error in getDashboardStats controller:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to get dashboard stats",
      });
    }
  }

  async getOnboardingStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Não autenticado" });
        return;
      }

      const status = await dashboardService.getOnboardingStatus(req.user.companyId, req.user.userId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error("Dashboard onboarding error:", error);
      res.status(500).json({ success: false, message: "Erro ao buscar status de onboarding" });
    }
  }

  async getChartsData(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Não autenticado" });
        return;
      }

      const preset = (req.query.preset as string) || "7days";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const chartsData = await dashboardService.getChartsData(req.user.companyId, preset, startDate, endDate);

      res.status(200).json({
        success: true,
        data: chartsData,
      });
    } catch (error) {
      console.error("Dashboard charts error:", error);
      res.status(500).json({ success: false, message: "Erro ao buscar dados dos gráficos" });
    }
  }
}

export default new DashboardController();
