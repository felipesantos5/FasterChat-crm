import { Router } from "express";
import { serviceController } from "../controllers/service.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// ==================== SERVICES ====================
router.get("/", serviceController.listServices);
router.get("/for-ai", serviceController.getServicesForAI);
router.get("/pricing-complete", serviceController.getCompletePricingForAI);
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

// ==================== PRICING TIERS ====================
router.get("/:serviceId/pricing-tiers", serviceController.listPricingTiers);
router.put("/:serviceId/pricing-tiers", serviceController.setPricingTiers);

// ==================== ZONES ====================
router.get("/zones/list", serviceController.listZones);
router.get("/zones/:id", serviceController.getZone);
router.post("/zones", serviceController.createZone);
router.put("/zones/:id", serviceController.updateZone);
router.delete("/zones/:id", serviceController.deleteZone);

// ==================== COMBOS ====================
router.get("/combos/list", serviceController.listCombos);
router.get("/combos/:id", serviceController.getCombo);
router.post("/combos", serviceController.createCombo);
router.put("/combos/:id", serviceController.updateCombo);
router.delete("/combos/:id", serviceController.deleteCombo);
router.put("/combos/:id/items", serviceController.setComboItems);

// ==================== ADDITIONALS ====================
router.get("/additionals/list", serviceController.listAdditionals);
router.post("/additionals", serviceController.createAdditional);
router.put("/additionals/:id", serviceController.updateAdditional);
router.delete("/additionals/:id", serviceController.deleteAdditional);

// ==================== ZONE EXCEPTIONS ====================
router.get("/zone-exceptions/list", serviceController.listZoneExceptions);
router.post("/zone-exceptions", serviceController.createZoneException);
router.delete("/zone-exceptions/:id", serviceController.deleteZoneException);

export default router;
