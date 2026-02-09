import { Router } from "express";
import dashboardController from "../controllers/dashboard.controller";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/errorHandler";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * GET /api/dashboard/stats?period=today|week|month
 * Obtém estatísticas do dashboard com comparação temporal
 */
router.get("/stats", asyncHandler(dashboardController.getStats.bind(dashboardController)));
router.get("/onboarding", asyncHandler(dashboardController.getOnboardingStatus.bind(dashboardController)));
router.get("/charts", asyncHandler(dashboardController.getChartsData.bind(dashboardController)));

export default router;
