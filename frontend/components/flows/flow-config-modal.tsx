import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TagSelector } from "@/components/forms/tag-selector";
import { Tag, tagApi } from "@/lib/tag";
import api from "@/lib/api";
import { toast } from "sonner";

interface FlowConfigModalProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  initialTags?: string[];
  initialStatus?: string;
  onSave: (tags: string[], status: string) => void;
}

export function FlowConfigModal({
  open,
  onClose,
  flowId,
  initialTags = [],
  initialStatus = "DRAFT",
  onSave,
}: FlowConfigModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("DRAFT");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTags(initialTags);
      setStatus(initialStatus);
      fetchTags();
    }
  }, [open, initialTags, initialStatus]);

  const fetchTags = async () => {
    try {
      const resTags = await tagApi.getAll();
      setAvailableTags(resTags);
    } catch (error) {
      console.error("Error fetching tags", error);
      toast.error("Erro ao carregar tags disponíveis.");
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await api.put(`/flows/${flowId}`, {
        autoTags: tags,
        status: status,
      });
      toast.success("Configuração do fluxo salva com sucesso.");
      onSave(tags, status);
      onClose();
    } catch (error) {
      console.error("Error saving flow config", error);
      toast.error("Erro ao salvar configuração do fluxo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isActive = status === "ACTIVE";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configurar Fluxo</DialogTitle>
          <DialogDescription>
            Ative ou desative o fluxo e defina as tags que serão adicionadas automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Status do Fluxo</Label>
              <p className="text-sm text-muted-foreground">
                {isActive ? "Fluxo ativo e respondendo aos clientes." : "Fluxo desativado (Rascunho)."}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setStatus(checked ? "ACTIVE" : "DRAFT")}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags Automáticas</Label>
            <TagSelector
              value={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="Selecionar tags..."
              disabled={isSubmitting}
              onTagCreated={fetchTags}
            />
            <p className="text-xs text-muted-foreground">
              Selecione tags existentes ou crie novas para organizar clientes vindos deste fluxo.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
