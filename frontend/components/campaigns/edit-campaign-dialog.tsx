"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { Campaign } from "@/types/campaign";
import { campaignApi } from "@/lib/campaign";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface EditCampaignDialogProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCampaignDialog({
  campaign,
  isOpen,
  onClose,
  onSuccess,
}: EditCampaignDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    messageTemplate: "",
    targetTags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  // Atualiza form quando campaign muda
  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        messageTemplate: campaign.messageTemplate,
        targetTags: [...campaign.targetTags],
      });
    }
  }, [campaign]);

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.targetTags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        targetTags: [...formData.targetTags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      targetTags: formData.targetTags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaign) return;

    // Validações
    if (!formData.name.trim()) {
      toast.error("Nome da campanha é obrigatório");
      return;
    }

    if (!formData.messageTemplate.trim()) {
      toast.error("Mensagem da campanha é obrigatória");
      return;
    }

    if (formData.targetTags.length === 0) {
      toast.error("Adicione pelo menos uma tag alvo");
      return;
    }

    try {
      setLoading(true);

      await campaignApi.update(campaign.id, {
        name: formData.name.trim(),
        messageTemplate: formData.messageTemplate.trim(),
        targetTags: formData.targetTags,
      });

      toast.success("Campanha atualizada com sucesso!");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating campaign:", error);
      toast.error(
        error.response?.data?.message || "Erro ao atualizar campanha"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Campanha</DialogTitle>
            <DialogDescription>
              Atualize as informações da campanha. Apenas campanhas em rascunho
              podem ser editadas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nome da Campanha */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nome da Campanha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: Promoção de Natal 2024"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={loading}
                required
              />
            </div>

            {/* Mensagem */}
            <div className="grid gap-2">
              <Label htmlFor="messageTemplate">
                Mensagem <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="messageTemplate"
                placeholder="Digite a mensagem que será enviada..."
                value={formData.messageTemplate}
                onChange={(e) =>
                  setFormData({ ...formData, messageTemplate: e.target.value })
                }
                disabled={loading}
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"} para inserir o nome do cliente automaticamente
              </p>
            </div>

            {/* Tags Alvo */}
            <div className="grid gap-2">
              <Label htmlFor="tags">
                Tags Alvo <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Digite uma tag e pressione Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddTag}
                  disabled={loading || !tagInput.trim()}
                >
                  Adicionar
                </Button>
              </div>

              {/* Lista de Tags */}
              {formData.targetTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.targetTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                A campanha será enviada apenas para clientes com essas tags
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
