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
      const period = (req.query.period as "today" | "week" | "month") || "today";

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Company ID is required",
        });
      }

      const stats = await dashboardService.getDashboardStats(companyId, period);

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
}

export default new DashboardController();
