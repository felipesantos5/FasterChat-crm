import { Router } from "express";
import { customerController } from "../controllers/customer.controller";
import { authenticate } from "../middlewares/auth";
import { checkPermission } from "../middlewares/permission";
import { asyncHandler } from "../middlewares/errorHandler";
import { customerAddressService } from "../services/customer-address.service";
import { customerServiceCardService } from "../services/customer-service-card.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD
router.post("/", checkPermission("CUSTOMERS", true), asyncHandler(customerController.create.bind(customerController)));
router.get("/", checkPermission("CUSTOMERS", false), asyncHandler(customerController.findAll.bind(customerController)));
router.get("/stats", checkPermission("CUSTOMERS", false), asyncHandler(customerController.getStats.bind(customerController)));
router.get("/tags", checkPermission("CUSTOMERS", false), asyncHandler(customerController.getAllTags.bind(customerController)));
// Customer Addresses
router.get("/:id/addresses", checkPermission("CUSTOMERS", false), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.user!.companyId;
  const data = await customerAddressService.getAll(id, companyId);
  res.json({ success: true, data });
}));

router.post("/:id/addresses", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.user!.companyId;
  const address = await customerAddressService.create(id, companyId, req.body);
  res.status(201).json({ success: true, data: address });
}));

router.put("/:id/addresses/:addressId", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;
  const companyId = req.user!.companyId;
  await customerAddressService.update(id, addressId, companyId, req.body);
  const updated = await customerAddressService.getById(id, addressId, companyId);
  res.json({ success: true, data: updated });
}));

router.delete("/:id/addresses/:addressId", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;
  const companyId = req.user!.companyId;
  await customerAddressService.delete(id, addressId, companyId);
  res.json({ success: true });
}));

router.patch("/:id/addresses/:addressId/default", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;
  const companyId = req.user!.companyId;
  await customerAddressService.setDefault(id, addressId, companyId);
  const updated = await customerAddressService.getById(id, addressId, companyId);
  res.json({ success: true, data: updated });
}));

// Customer Service Cards
router.get("/:id/service-cards", checkPermission("CUSTOMERS", false), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.user!.companyId;
  const data = await customerServiceCardService.getAll(id, companyId);
  res.json({ success: true, data });
}));

router.post("/:id/service-cards", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.user!.companyId;
  const card = await customerServiceCardService.create(id, companyId, req.body);
  res.status(201).json({ success: true, data: card });
}));

router.put("/:id/service-cards/:cardId", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id, cardId } = req.params;
  const companyId = req.user!.companyId;
  await customerServiceCardService.update(id, cardId, companyId, req.body);
  const updated = await customerServiceCardService.getById(id, cardId, companyId);
  res.json({ success: true, data: updated });
}));

router.delete("/:id/service-cards/:cardId", checkPermission("CUSTOMERS", true), asyncHandler(async (req, res) => {
  const { id, cardId } = req.params;
  const companyId = req.user!.companyId;
  await customerServiceCardService.delete(id, cardId, companyId);
  res.json({ success: true });
}));

router.get("/:id", checkPermission("CUSTOMERS", false), asyncHandler(customerController.findById.bind(customerController)));
router.put("/:id", checkPermission("CUSTOMERS", true), asyncHandler(customerController.update.bind(customerController)));
router.delete("/:id", checkPermission("CUSTOMERS", true), asyncHandler(customerController.delete.bind(customerController)));
router.patch("/:id/archive", checkPermission("CUSTOMERS", true), asyncHandler(customerController.archive.bind(customerController)));
router.patch("/:id/unarchive", checkPermission("CUSTOMERS", true), asyncHandler(customerController.unarchive.bind(customerController)));
router.post("/import", checkPermission("CUSTOMERS", true), asyncHandler(customerController.import.bind(customerController)));

export default router;
