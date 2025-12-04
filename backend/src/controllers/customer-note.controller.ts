import { Request, Response } from "express";
import customerNoteService from "../services/customer-note.service";

class CustomerNoteController {
  /**
   * POST /api/customer-notes
   * Cria uma nova nota para um cliente
   */
  async createNote(req: Request, res: Response) {
    try {
      const { customerId, note } = req.body;
      const userId = (req as any).user?.userId;

      if (!customerId || !note) {
        return res.status(400).json({
          success: false,
          message: "Customer ID and note are required",
        });
      }

      if (!userId) {
        console.error("[CustomerNote] User ID not found in request. User object:", (req as any).user);
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const customerNote = await customerNoteService.createNote(customerId, userId, note);

      return res.status(201).json({
        success: true,
        data: customerNote,
      });
    } catch (error: any) {
      console.error("Error in createNote controller:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create customer note",
      });
    }
  }

  /**
   * GET /api/customer-notes/:customerId
   * Obtém todas as notas de um cliente
   */
  async getCustomerNotes(req: Request, res: Response) {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required",
        });
      }

      const notes = await customerNoteService.getCustomerNotes(customerId);

      return res.status(200).json({
        success: true,
        data: notes,
      });
    } catch (error: any) {
      console.error("Error in getCustomerNotes controller:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to get customer notes",
      });
    }
  }

  /**
   * PUT /api/customer-notes/:noteId
   * Atualiza uma nota
   */
  async updateNote(req: Request, res: Response) {
    try {
      const { noteId } = req.params;
      const { note } = req.body;
      const userId = (req as any).user?.userId;

      if (!noteId || !note) {
        return res.status(400).json({
          success: false,
          message: "Note ID and note content are required",
        });
      }

      if (!userId) {
        console.error("[CustomerNote] User ID not found in request. User object:", (req as any).user);
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const updatedNote = await customerNoteService.updateNote(noteId, userId, note);

      return res.status(200).json({
        success: true,
        data: updatedNote,
      });
    } catch (error: any) {
      console.error("Error in updateNote controller:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update customer note",
      });
    }
  }

  /**
   * DELETE /api/customer-notes/:noteId
   * Deleta uma nota
   */
  async deleteNote(req: Request, res: Response) {
    try {
      const { noteId } = req.params;
      const userId = (req as any).user?.userId;

      if (!noteId) {
        return res.status(400).json({
          success: false,
          message: "Note ID is required",
        });
      }

      if (!userId) {
        console.error("[CustomerNote] User ID not found in request. User object:", (req as any).user);
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      await customerNoteService.deleteNote(noteId, userId);

      return res.status(200).json({
        success: true,
        data: { success: true },
      });
    } catch (error: any) {
      console.error("Error in deleteNote controller:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete customer note",
      });
    }
  }
}

export default new CustomerNoteController();
