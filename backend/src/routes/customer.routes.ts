import { Router } from "express";
import { customerController } from "../controllers/customer.controller";
import { authenticate } from "../middlewares/auth";
import { checkPermission } from "../middlewares/permission";
import { asyncHandler } from "../middlewares/errorHandler";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.post("/", checkPermission("CUSTOMERS", true), asyncHandler(customerController.create.bind(customerController)));
router.get("/", checkPermission("CUSTOMERS", false), asyncHandler(customerController.findAll.bind(customerController)));
router.get("/stats", checkPermission("CUSTOMERS", false), asyncHandler(customerController.getStats.bind(customerController)));
router.get("/tags", checkPermission("CUSTOMERS", false), asyncHandler(customerController.getAllTags.bind(customerController)));
router.get("/:id", checkPermission("CUSTOMERS", false), asyncHandler(customerController.findById.bind(customerController)));
router.put("/:id", checkPermission("CUSTOMERS", true), asyncHandler(customerController.update.bind(customerController)));
router.delete("/:id", checkPermission("CUSTOMERS", true), asyncHandler(customerController.delete.bind(customerController)));
router.post("/import", checkPermission("CUSTOMERS", true), asyncHandler(customerController.import.bind(customerController)));

export default router;
