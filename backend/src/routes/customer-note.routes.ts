import { Router } from "express";
import customerNoteController from "../controllers/customer-note.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Todas as rotas de notas requerem autenticação
router.use(authenticate);

// POST /api/customer-notes - Cria uma nova nota
router.post("/", customerNoteController.createNote.bind(customerNoteController));

// GET /api/customer-notes/:customerId - Obtém todas as notas de um cliente
router.get("/:customerId", customerNoteController.getCustomerNotes.bind(customerNoteController));

// PUT /api/customer-notes/:noteId - Atualiza uma nota
router.put("/:noteId", customerNoteController.updateNote.bind(customerNoteController));

// DELETE /api/customer-notes/:noteId - Deleta uma nota
router.delete("/:noteId", customerNoteController.deleteNote.bind(customerNoteController));

export default router;
