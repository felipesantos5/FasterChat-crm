import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../middlewares/errorHandler";
import { customFieldController } from "../controllers/custom-field.controller";

const router = Router();

router.get("/", authenticate, asyncHandler(customFieldController.getDefinitions.bind(customFieldController)));
router.post("/", authenticate, asyncHandler(customFieldController.createDefinition.bind(customFieldController)));
router.put("/:id", authenticate, asyncHandler(customFieldController.updateDefinition.bind(customFieldController)));
router.delete("/:id", authenticate, asyncHandler(customFieldController.deleteDefinition.bind(customFieldController)));

export default router;
