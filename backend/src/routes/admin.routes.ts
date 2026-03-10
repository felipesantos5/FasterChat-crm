import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { adminAuthenticate } from "../middlewares/admin-auth";
import { asyncHandler } from "../middlewares/errorHandler";

const router = Router();

// Rota de login (pública)
router.post("/login", asyncHandler(adminController.login));

// Rotas protegidas
router.get("/companies", adminAuthenticate, asyncHandler(adminController.listCompanies));
router.get("/stats", adminAuthenticate, asyncHandler(adminController.getStats));

// Seed de dados HVAC para cliente específico
router.post("/seed-hvac/:companyId", adminAuthenticate, asyncHandler(adminController.seedHvacData));

// Custos de IA por empresa
router.get("/companies/:companyId/ai-costs", adminAuthenticate, asyncHandler(adminController.getCompanyAiCosts));

// Atualizar plano de uma empresa
router.patch("/companies/:companyId/plan", adminAuthenticate, asyncHandler(adminController.updateCompanyPlan));

export default router;
