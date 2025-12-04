import { prisma } from "../utils/prisma";

class CustomerNoteService {
  /**
   * Cria uma nova nota para um cliente
   */
  async createNote(customerId: string, userId: string, note: string) {
    try {
      const customerNote = await prisma.customerNote.create({
        data: {
          customerId,
          userId,
          note,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return customerNote;
    } catch (error: any) {
      console.error("Error creating customer note:", error);
      throw new Error(`Failed to create customer note: ${error.message}`);
    }
  }

  /**
   * Obtém todas as notas de um cliente
   */
  async getCustomerNotes(customerId: string) {
    try {
      const notes = await prisma.customerNote.findMany({
        where: {
          customerId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return notes;
    } catch (error: any) {
      console.error("Error getting customer notes:", error);
      throw new Error(`Failed to get customer notes: ${error.message}`);
    }
  }

  /**
   * Atualiza uma nota
   */
  async updateNote(noteId: string, userId: string, note: string) {
    try {
      // Verifica se a nota pertence ao usuário
      const existingNote = await prisma.customerNote.findUnique({
        where: { id: noteId },
      });

      if (!existingNote) {
        throw new Error("Note not found");
      }

      if (existingNote.userId !== userId) {
        throw new Error("You can only edit your own notes");
      }

      const updatedNote = await prisma.customerNote.update({
        where: { id: noteId },
        data: { note },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return updatedNote;
    } catch (error: any) {
      console.error("Error updating customer note:", error);
      throw new Error(`Failed to update customer note: ${error.message}`);
    }
  }

  /**
   * Deleta uma nota
   */
  async deleteNote(noteId: string, userId: string) {
    try {
      // Verifica se a nota pertence ao usuário
      const existingNote = await prisma.customerNote.findUnique({
        where: { id: noteId },
      });

      if (!existingNote) {
        throw new Error("Note not found");
      }

      if (existingNote.userId !== userId) {
        throw new Error("You can only delete your own notes");
      }

      await prisma.customerNote.delete({
        where: { id: noteId },
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error deleting customer note:", error);
      throw new Error(`Failed to delete customer note: ${error.message}`);
    }
  }
}

export default new CustomerNoteService();
