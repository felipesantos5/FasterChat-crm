import { Router } from "express";
import { customerController } from "../controllers/customer.controller";
import { authenticate } from "../middlewares/auth";
import { checkPermission } from "../middlewares/permission";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.post("/", checkPermission("CUSTOMERS", true), customerController.create.bind(customerController));
router.get("/", checkPermission("CUSTOMERS", false), customerController.findAll.bind(customerController));
router.get("/stats", checkPermission("CUSTOMERS", false), customerController.getStats.bind(customerController));
router.get("/tags", checkPermission("CUSTOMERS", false), customerController.getAllTags.bind(customerController));
router.get("/:id", checkPermission("CUSTOMERS", false), customerController.findById.bind(customerController));
router.put("/:id", checkPermission("CUSTOMERS", true), customerController.update.bind(customerController));
router.delete("/:id", checkPermission("CUSTOMERS", true), customerController.delete.bind(customerController));
router.post("/import", checkPermission("CUSTOMERS", true), customerController.import.bind(customerController));

export default router;
