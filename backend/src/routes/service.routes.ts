import { Router } from "express";
import { serviceController } from "../controllers/service.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// ==================== SERVICES ====================
router.get("/", serviceController.listServices);
router.get("/for-ai", serviceController.getServicesForAI);
router.get("/:id", serviceController.getService);
router.post("/", serviceController.createService);
router.post("/save-complete", serviceController.saveServiceComplete);
router.put("/reorder", serviceController.reorderServices);
router.put("/:id", serviceController.updateService);
router.delete("/:id", serviceController.deleteService);

// ==================== VARIABLES ====================
router.post("/:serviceId/variables", serviceController.createVariable);
router.put("/variables/:variableId", serviceController.updateVariable);
router.delete("/variables/:variableId", serviceController.deleteVariable);

// ==================== OPTIONS ====================
router.post("/variables/:variableId/options", serviceController.createOption);
router.put("/options/:optionId", serviceController.updateOption);
router.delete("/options/:optionId", serviceController.deleteOption);

export default router;
