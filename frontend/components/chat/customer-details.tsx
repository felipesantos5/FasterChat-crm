"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Phone, Mail, Tag, FileText, Send, Loader2, Trash2, Edit2, DollarSign, Plus, TrendingUp } from "lucide-react";
import { customerNoteApi } from "@/lib/customer-note";
import { CustomerNote } from "@/types/customer-note";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pipelineApi, DealValueItem } from "@/lib/pipeline";
import { PipelineStage } from "@/types/pipeline";
import { customerApi } from "@/lib/customer";

interface CustomerDetailsProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerTags?: string[];
}

export function CustomerDetails({ customerId, customerName, customerPhone, customerEmail, customerTags = [] }: CustomerDetailsProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string | "none">("none");
  const [updatingStage, setUpdatingStage] = useState(false);

  // Histórico de vendas
  const [dealValues, setDealValues] = useState<DealValueItem[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealValue, setDealValue] = useState("");
  const [dealNotes, setDealNotes] = useState("");
  const [dealStageId, setDealStageId] = useState("");
  const [submittingDeal, setSubmittingDeal] = useState(false);

  // Obtém ID do usuário logado e companyId
  const getUserData = () => {
    const user = localStorage.getItem("user");
    if (user) {
      return JSON.parse(user);
    }
    return null;
  };

  const userData = getUserData();
  const currentUserId = userData?.id || null;
  const companyId = userData?.companyId || null;

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

  const loadCustomerAndStages = async () => {
    try {
      if (!companyId) return;

      const [customer, loadedStages] = await Promise.all([
        customerApi.getById(customerId),
        pipelineApi.getStages(companyId)
      ]);

      setCurrentStageId(customer.pipelineStageId || "none");
      setStages(loadedStages.sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error("Error loading customer or stages", e);
    }
  };

  const loadDealValues = async () => {
    try {
      setLoadingDeals(true);
      const data = await pipelineApi.getDealValuesByCustomer(customerId);
      setDealValues(data);
    } catch (error) {
      console.error("Error loading deal values:", error);
    } finally {
      setLoadingDeals(false);
    }
  };

  useEffect(() => {
    loadNotes();
    loadCustomerAndStages();
    loadDealValues();
  }, [customerId]);

  const handleStageChange = async (value: string) => {
    if (!companyId) return;

    try {
      setUpdatingStage(true);
      const stageId = value === "none" ? null : value;
      await pipelineApi.moveCustomer(customerId, companyId, { stageId });
      setCurrentStageId(value);
      toast.success("Estágio do funil atualizado");
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Erro ao atualizar o estágio");
    } finally {
      setUpdatingStage(false);
    }
  };

  // Registra uma venda manualmente
  const handleAddDeal = async () => {
    const parsedValue = parseFloat(dealValue.replace(",", "."));
    if (!dealValue.trim() || isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Informe um valor válido para a venda");
      return;
    }
    if (!dealStageId) {
      toast.error("Selecione o estágio da venda");
      return;
    }
    if (!companyId) return;

    try {
      setSubmittingDeal(true);
      await pipelineApi.createDealValue(companyId, {
        customerId,
        stageId: dealStageId,
        value: parsedValue,
        notes: dealNotes.trim() || undefined,
      });
      toast.success("Venda registrada com sucesso!");
      setDealValue("");
      setDealNotes("");
      setDealStageId("");
      setShowAddDeal(false);
      await loadDealValues();
    } catch (error) {
      console.error("Error adding deal:", error);
      toast.error("Erro ao registrar venda");
    } finally {
      setSubmittingDeal(false);
    }
  };

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

  return (
    <div className="flex flex-col h-full p-4 space-y-4 overflow-y-auto overflow-x-hidden">
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
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium truncate">{formatPhoneNumber(customerPhone)}</p>
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

          <div className="flex items-start gap-2 pt-1">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Estágio do Funil</p>
              <Select value={currentStageId} onValueChange={handleStageChange} disabled={updatingStage || stages.length === 0}>
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Sem estágio definido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs text-muted-foreground">
                    Sem estágio definido
                  </SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full mt-4 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
            variant="outline"
            onClick={() => router.push(`/dashboard/customers/${customerId}`)}
          >
            Ver Detalhes Completo
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Histórico de Vendas
              {dealValues.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {dealValues.length}
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setShowAddDeal((v) => !v)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Formulário de nova venda */}
          {showAddDeal && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground">Nova Venda</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="0,00"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <Select value={dealStageId} onValueChange={setDealStageId}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Descrição do serviço / produto (opcional)"
                value={dealNotes}
                onChange={(e) => setDealNotes(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddDeal} disabled={submittingDeal} className="flex-1">
                  {submittingDeal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddDeal(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de vendas */}
          {loadingDeals ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : dealValues.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma venda registrada</p>
          ) : (
            <div className="space-y-2">
              {dealValues.map((deal) => (
                <div key={deal.id} className="border rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-green-600">
                      {Number(deal.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.stage.color }} />
                      <span className="text-[10px] text-muted-foreground">{deal.stage.name}</span>
                    </div>
                  </div>
                  {deal.notes && (
                    <p className="text-xs text-muted-foreground">{deal.notes}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(deal.closedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              ))}
              {dealValues.length > 1 && (
                <div className="pt-1 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-green-600">
                    {dealValues.reduce((acc, d) => acc + Number(d.value), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              )}
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
