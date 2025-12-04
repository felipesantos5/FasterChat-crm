import { api } from "./api";
import {
  CreateCustomerNoteRequest,
  CreateCustomerNoteResponse,
  GetCustomerNotesResponse,
  UpdateCustomerNoteRequest,
  UpdateCustomerNoteResponse,
  DeleteCustomerNoteResponse,
} from "@/types/customer-note";

export const customerNoteApi = {
  /**
   * Cria uma nova nota para um cliente
   */
  async createNote(data: CreateCustomerNoteRequest): Promise<CreateCustomerNoteResponse> {
    const response = await api.post("/customer-notes", data);
    return response.data;
  },

  /**
   * Obtém todas as notas de um cliente
   */
  async getCustomerNotes(customerId: string): Promise<GetCustomerNotesResponse> {
    const response = await api.get(`/customer-notes/${customerId}`);
    return response.data;
  },

  /**
   * Atualiza uma nota
   */
  async updateNote(noteId: string, data: UpdateCustomerNoteRequest): Promise<UpdateCustomerNoteResponse> {
    const response = await api.put(`/customer-notes/${noteId}`, data);
    return response.data;
  },

  /**
   * Deleta uma nota
   */
  async deleteNote(noteId: string): Promise<DeleteCustomerNoteResponse> {
    const response = await api.delete(`/customer-notes/${noteId}`);
    return response.data;
  },
};
