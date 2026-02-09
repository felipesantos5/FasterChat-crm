import { Router } from "express";
import { serviceController } from "../controllers/service.controller";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/errorHandler";

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// ==================== SERVICES ====================
router.get("/", asyncHandler(serviceController.listServices));
router.get("/for-ai", asyncHandler(serviceController.getServicesForAI));
router.get("/pricing-complete", asyncHandler(serviceController.getCompletePricingForAI));
router.get("/:id", asyncHandler(serviceController.getService));
router.post("/", asyncHandler(serviceController.createService));
router.post("/save-complete", asyncHandler(serviceController.saveServiceComplete));
router.put("/reorder", asyncHandler(serviceController.reorderServices));
router.put("/:id", asyncHandler(serviceController.updateService));
router.delete("/:id", asyncHandler(serviceController.deleteService));

// ==================== VARIABLES ====================
router.post("/:serviceId/variables", asyncHandler(serviceController.createVariable));
router.put("/variables/:variableId", asyncHandler(serviceController.updateVariable));
router.delete("/variables/:variableId", asyncHandler(serviceController.deleteVariable));

// ==================== OPTIONS ====================
router.post("/variables/:variableId/options", asyncHandler(serviceController.createOption));
router.put("/options/:optionId", asyncHandler(serviceController.updateOption));
router.delete("/options/:optionId", asyncHandler(serviceController.deleteOption));

// ==================== PRICING TIERS ====================
router.get("/:serviceId/pricing-tiers", asyncHandler(serviceController.listPricingTiers));
router.put("/:serviceId/pricing-tiers", asyncHandler(serviceController.setPricingTiers));

// ==================== ZONES ====================
router.get("/zones/list", asyncHandler(serviceController.listZones));
router.get("/zones/:id", asyncHandler(serviceController.getZone));
router.post("/zones", asyncHandler(serviceController.createZone));
router.put("/zones/:id", asyncHandler(serviceController.updateZone));
router.delete("/zones/:id", asyncHandler(serviceController.deleteZone));

// ==================== COMBOS ====================
router.get("/combos/list", asyncHandler(serviceController.listCombos));
router.get("/combos/:id", asyncHandler(serviceController.getCombo));
router.post("/combos", asyncHandler(serviceController.createCombo));
router.put("/combos/:id", asyncHandler(serviceController.updateCombo));
router.delete("/combos/:id", asyncHandler(serviceController.deleteCombo));
router.put("/combos/:id/items", asyncHandler(serviceController.setComboItems));

// ==================== ADDITIONALS ====================
router.get("/additionals/list", asyncHandler(serviceController.listAdditionals));
router.post("/additionals", asyncHandler(serviceController.createAdditional));
router.put("/additionals/:id", asyncHandler(serviceController.updateAdditional));
router.delete("/additionals/:id", asyncHandler(serviceController.deleteAdditional));

// ==================== ZONE EXCEPTIONS ====================
router.get("/zone-exceptions/list", asyncHandler(serviceController.listZoneExceptions));
router.post("/zone-exceptions", asyncHandler(serviceController.createZoneException));
router.delete("/zone-exceptions/:id", asyncHandler(serviceController.deleteZoneException));

export default router;
