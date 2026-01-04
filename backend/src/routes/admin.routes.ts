import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { adminAuthenticate } from "../middlewares/admin-auth";

const router = Router();

// Rota de login (pública)
router.post("/login", adminController.login);

// Rotas protegidas
router.get("/companies", adminAuthenticate, adminController.listCompanies);
router.get("/stats", adminAuthenticate, adminController.getStats);

export default router;
