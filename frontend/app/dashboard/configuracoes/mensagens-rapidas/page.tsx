"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Type,
  ImageIcon,
  Mic,
  Loader2,
  Upload,
} from "lucide-react";
import { QuickMessage, QuickMessageType, CreateQuickMessageData } from "@/types/quick-message";
import { quickMessageApi } from "@/lib/quick-message";
import { toast } from "sonner";

const TYPE_OPTIONS: { value: QuickMessageType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "TEXT", label: "Texto", icon: <Type className="h-4 w-4" />, desc: "Mensagem de texto simples" },
  { value: "MEDIA", label: "Imagem / Vídeo", icon: <ImageIcon className="h-4 w-4" />, desc: "Foto ou vídeo com legenda opcional" },
  { value: "AUDIO", label: "Áudio", icon: <Mic className="h-4 w-4" />, desc: "Mensagem de voz" },
];

const TYPE_BADGE: Record<QuickMessageType, { label: string; className: string }> = {
  TEXT: { label: "Texto", className: "bg-blue-100 text-blue-700 border-blue-200" },
  MEDIA: { label: "Mídia", className: "bg-purple-100 text-purple-700 border-purple-200" },
  AUDIO: { label: "Áudio", className: "bg-green-100 text-green-700 border-green-200" },
};

const MEDIA_ACCEPT = "image/*,video/*";
const AUDIO_ACCEPT = "audio/*";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MensagensRapidasPage() {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuickMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateQuickMessageData>({ title: "", type: "TEXT", content: "", caption: "" });
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      setMessages(await quickMessageApi.findAll());
    } catch {
      toast.error("Erro ao carregar mensagens rápidas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ title: "", type: "TEXT", content: "", caption: "" });
    setFilePreview(null);
    setDialogOpen(true);
  }

  function openEdit(msg: QuickMessage) {
    setEditingId(msg.id);
    setForm({ title: msg.title, type: msg.type, content: msg.content, caption: msg.caption ?? "" });
    setFilePreview(msg.type !== "TEXT" ? msg.content : null);
    setDialogOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((prev) => ({ ...prev, content: base64 }));
    setFilePreview(base64);
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Digite um título."); return; }
    if (!form.content.trim()) { toast.error("O conteúdo não pode estar vazio."); return; }

    setSaving(true);
    try {
      if (editingId) {
        await quickMessageApi.update(editingId, { title: form.title, content: form.content, caption: form.caption });
        toast.success("Mensagem atualizada.");
      } else {
        await quickMessageApi.create(form);
        toast.success("Mensagem criada.");
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error("Erro ao salvar mensagem.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await quickMessageApi.delete(deleteTarget.id);
      toast.success("Mensagem excluída.");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Erro ao excluir mensagem.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Mensagens Rápidas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mensagens salvas para envio rápido durante o atendimento.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova mensagem
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">Nenhuma mensagem rápida</p>
          <p className="text-sm text-muted-foreground mb-4">
            Crie atalhos de texto, imagem ou áudio para acelerar o atendimento.
          </p>
          <Button onClick={openCreate} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />
            Criar primeira mensagem
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => {
            const badge = TYPE_BADGE[msg.type];
            return (
              <div
                key={msg.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{msg.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </div>
                  {msg.type === "TEXT" && (
                    <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
                  )}
                  {msg.type === "MEDIA" && (
                    <p className="text-xs text-muted-foreground">
                      {msg.caption ? `Legenda: ${msg.caption}` : "Sem legenda"}
                    </p>
                  )}
                  {msg.type === "AUDIO" && (
                    <p className="text-xs text-muted-foreground">Mensagem de voz</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(msg)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(msg)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar mensagem" : "Nova mensagem rápida"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Título */}
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                placeholder="Ex: Boas-vindas, Proposta, Horário"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            {/* Tipo (só ao criar) */}
            {!editingId && (
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setForm((p) => ({ ...p, type: opt.value, content: "", caption: "" }));
                        setFilePreview(null);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition-colors ${
                        form.type === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-accent text-muted-foreground"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo */}
            {form.type === "TEXT" ? (
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Digite a mensagem..."
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  rows={4}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{form.type === "AUDIO" ? "Arquivo de áudio" : "Imagem ou vídeo"}</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept={form.type === "AUDIO" ? AUDIO_ACCEPT : MEDIA_ACCEPT}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-accent transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {filePreview ? "Trocar arquivo" : "Selecionar arquivo"}
                  </span>
                </button>
                {filePreview && form.type === "MEDIA" && filePreview.startsWith("data:image") && (
                  <img src={filePreview} alt="preview" className="rounded-lg max-h-32 object-cover w-full" />
                )}
                {filePreview && form.type === "AUDIO" && (
                  <audio controls src={filePreview} className="w-full" />
                )}
                {filePreview && form.type === "MEDIA" && filePreview.startsWith("data:video") && (
                  <video src={filePreview} controls className="w-full rounded-lg max-h-32" />
                )}
              </div>
            )}

            {/* Legenda para mídia */}
            {form.type === "MEDIA" && (
              <div className="space-y-1.5">
                <Label>Legenda <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  placeholder="Ex: Confira nossa proposta!"
                  value={form.caption ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, caption: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem <strong>{deleteTarget?.title}</strong> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
