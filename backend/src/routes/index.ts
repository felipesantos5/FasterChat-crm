import { Router } from "express";
import authRoutes from "./auth.routes";
import customerRoutes from "./customer.routes";
import whatsappRoutes from "./whatsapp.routes";
import messageRoutes from "./message.routes";
import webhookRoutes from "./webhook.routes";
import conversationRoutes from "./conversation.routes";
import conversationExampleRoutes from "./conversation-example.routes";
import aiKnowledgeRoutes from "./ai-knowledge.routes";
import campaignRoutes from "./campaign.routes";
import tagRoutes from "./tag.routes";
import dashboardRoutes from "./dashboard.routes";
import pipelineRoutes from "./pipeline.routes";
import googleCalendarRoutes from "./google-calendar.routes";
import appointmentRoutes from "./appointment.routes";
import whatsappLinkRoutes from "./whatsapp-link.routes";
import conversationExampleController from "../controllers/conversation-example.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/messages", messageRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/conversations", conversationRoutes);
router.use("/conversations", conversationExampleRoutes);
router.use("/ai", aiKnowledgeRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/tags", tagRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/pipeline", pipelineRoutes);
router.use("/google", googleCalendarRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/whatsapp-links", whatsappLinkRoutes);

// Rotas públicas (sem /api prefix) - devem ser registradas no server.ts
// router.use('/l', linkRedirectRoutes);

// Rota adicional para listar exemplos
router.get("/ai/examples", authenticate, conversationExampleController.getExamples);

export default router;
