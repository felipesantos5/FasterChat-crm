"use client";

import { useEffect, useState } from "react";
import { customFieldApi } from "@/lib/custom-field";
import { CustomFieldDefinition } from "@/types/custom-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash, GripVertical } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-800",
  number: "bg-green-100 text-green-800",
  date: "bg-purple-100 text-purple-800",
};

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

interface FieldFormState {
  label: string;
  name: string;
  type: "text" | "number" | "date";
  required: boolean;
  order: number;
}

const DEFAULT_FORM: FieldFormState = {
  label: "",
  name: "",
  type: "text",
  required: false,
  order: 0,
};

export default function CustomFieldsSettingsPage() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldDefinition | null>(null);
  const [form, setForm] = useState<FieldFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const loadFields = async () => {
    try {
      const data = await customFieldApi.getDefinitions();
      setFields(data);
    } catch {
      toast.error("Erro ao carregar campos personalizados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const openCreate = () => {
    setEditingField(null);
    setForm({ ...DEFAULT_FORM, order: fields.length });
    setNameManuallyEdited(false);
    setDialogOpen(true);
  };

  const openEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setForm({
      label: field.label,
      name: field.name,
      type: field.type,
      required: field.required,
      order: field.order,
    });
    setNameManuallyEdited(true);
    setDialogOpen(true);
  };

  const handleLabelChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      label: value,
      name: nameManuallyEdited && editingField ? prev.name : toSnakeCase(value),
    }));
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.name.trim()) {
      toast.error("Preencha o label e o nome interno");
      return;
    }

    setSaving(true);
    try {
      if (editingField) {
        await customFieldApi.updateDefinition(editingField.id, {
          label: form.label,
          required: form.required,
          order: form.order,
        });
        toast.success("Campo atualizado com sucesso");
      } else {
        await customFieldApi.createDefinition({
          label: form.label,
          name: form.name,
          type: form.type,
          required: form.required,
          order: form.order,
        });
        toast.success("Campo criado com sucesso");
      }
      setDialogOpen(false);
      await loadFields();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao salvar campo";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!fieldToDelete) return;
    try {
      await customFieldApi.deleteDefinition(fieldToDelete.id);
      toast.success("Campo excluído com sucesso");
      setFieldToDelete(null);
      await loadFields();
    } catch {
      toast.error("Erro ao excluir campo");
    }
  };

  return (
    <div className="space-y-6 p-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campos Personalizados</h1>
          <p className="text-muted-foreground mt-1">
            Adicione campos extras ao perfil de todos os clientes
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Campo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campos definidos</CardTitle>
          <CardDescription>
            Estes campos aparecerão no formulário de criação/edição e no perfil de cada cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhum campo personalizado definido ainda.</p>
              <Button variant="link" onClick={openCreate} className="mt-2">
                Criar primeiro campo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{field.label}</span>
                      <span className="text-xs text-muted-foreground font-mono">{field.name}</span>
                      <Badge className={`text-xs ${TYPE_BADGE_COLORS[field.type]}`}>
                        {TYPE_LABELS[field.type]}
                      </Badge>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(field)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setFieldToDelete(field)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? "Editar Campo" : "Novo Campo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Label <span className="text-destructive">*</span></Label>
              <Input
                value={form.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Ex: CPF, Data de Nascimento"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome interno <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setNameManuallyEdited(true);
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                }}
                placeholder="Ex: cpf, data_nascimento"
                disabled={saving || !!editingField}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Chave interna única. Somente letras minúsculas, números e underscores.
                {editingField && " Não pode ser alterado."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as any }))}
                disabled={saving || !!editingField}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
              {editingField && (
                <p className="text-xs text-muted-foreground">Tipo não pode ser alterado após criação.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="required"
                checked={form.required}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, required: v }))}
                disabled={saving}
              />
              <Label htmlFor="required">Campo obrigatório</Label>
            </div>

            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) => setForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                disabled={saving}
                className="w-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingField ? "Salvar Alterações" : "Criar Campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!fieldToDelete} onOpenChange={() => setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o campo <strong>{fieldToDelete?.label}</strong>?
              Todos os valores deste campo nos clientes serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
