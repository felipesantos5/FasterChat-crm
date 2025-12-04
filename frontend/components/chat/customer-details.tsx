"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Tag, FileText, Send, Loader2, Trash2, Edit2 } from "lucide-react";
import { customerNoteApi } from "@/lib/customer-note";
import { CustomerNote } from "@/types/customer-note";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface CustomerDetailsProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerTags?: string[];
}

export function CustomerDetails({ customerId, customerName, customerPhone, customerEmail, customerTags = [] }: CustomerDetailsProps) {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");

  // Carrega as notas do cliente
  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await customerNoteApi.getCustomerNotes(customerId);
      setNotes(response.data);
    } catch (error: any) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [customerId]);

  // Adiciona nova nota
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSubmitting(true);
      const response = await customerNoteApi.createNote({
        customerId,
        note: newNote.trim(),
      });
      setNotes([response.data, ...notes]);
      setNewNote("");
      toast.success("Observação adicionada com sucesso!");
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error(error.response?.data?.message || "Erro ao adicionar observação");
    } finally {
      setSubmitting(false);
    }
  };

  // Inicia edição de nota
  const handleStartEdit = (note: CustomerNote) => {
    setEditingNoteId(note.id);
    setEditingNote(note.note);
  };

  // Salva edição de nota
  const handleSaveEdit = async (noteId: string) => {
    if (!editingNote.trim()) return;

    try {
      const response = await customerNoteApi.updateNote(noteId, {
        note: editingNote.trim(),
      });
      setNotes(notes.map((n) => (n.id === noteId ? response.data : n)));
      setEditingNoteId(null);
      setEditingNote("");
      toast.success("Observação atualizada com sucesso!");
    } catch (error: any) {
      console.error("Error updating note:", error);
      toast.error(error.response?.data?.message || "Erro ao atualizar observação");
    }
  };

  // Cancela edição
  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNote("");
  };

  // Deleta nota
  const handleDeleteNote = async (noteId: string) => {
    toast.promise(
      customerNoteApi.deleteNote(noteId),
      {
        loading: "Excluindo observação...",
        success: () => {
          setNotes(notes.filter((n) => n.id !== noteId));
          return "Observação excluída com sucesso!";
        },
        error: (error: any) => {
          console.error("Error deleting note:", error);
          return error.response?.data?.message || "Erro ao excluir observação";
        },
      }
    );
  };

  // Obtém ID do usuário logado
  const getUserId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      return JSON.parse(user).id;
    }
    return null;
  };

  const currentUserId = getUserId();

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto">
      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium truncate">{customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium">{customerPhone}</p>
            </div>
          </div>

          {customerEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">{customerEmail}</p>
              </div>
            </div>
          )}

          {customerTags.length > 0 && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {customerTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Observações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add New Note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Adicionar observação sobre o cliente..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
            />
            <Button onClick={handleAddNote} disabled={!newNote.trim() || submitting} size="sm" className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Adicionar Observação
                </>
              )}
            </Button>
          </div>

          {/* Notes List */}
          <div className="space-y-3 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma observação ainda</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="border rounded-lg p-3 space-y-2">
                  {editingNoteId === note.id ? (
                    // Modo de edição
                    <div className="space-y-2">
                      <Textarea
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        className="min-h-[60px] text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => handleSaveEdit(note.id)} size="sm" variant="default" className="flex-1">
                          Salvar
                        </Button>
                        <Button onClick={handleCancelEdit} size="sm" variant="outline" className="flex-1">
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <>
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium">{note.user.name}</p>
                          <p>{format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                        {note.userId === currentUserId && (
                          <div className="flex gap-1">
                            <Button onClick={() => handleStartEdit(note)} size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button onClick={() => handleDeleteNote(note.id)} size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
