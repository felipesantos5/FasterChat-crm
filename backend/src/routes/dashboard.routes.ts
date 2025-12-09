import { Router } from "express";
import dashboardController from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * GET /api/dashboard/stats?period=today|week|month
 * Obtém estatísticas do dashboard com comparação temporal
 */
router.get("/stats", dashboardController.getStats.bind(dashboardController));
router.get("/onboarding", dashboardController.getOnboardingStatus.bind(dashboardController));
router.get("/charts", dashboardController.getChartsData.bind(dashboardController));

export default router;
