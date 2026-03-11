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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagSelector } from "@/components/forms/tag-selector";
import { Tag, tagApi } from "@/lib/tag";
import api from "@/lib/api";
import { toast } from "sonner";
import { Globe, Smartphone } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { whatsappApi } from "@/lib/whatsapp";

interface FlowConfigModalProps {
  open: boolean;
  onClose: () => void;
  flowId: string;
  initialTags?: string[];
  initialStatus?: string;
  initialSendWindowEnabled?: boolean;
  initialSendWindowStart?: number;
  initialSendWindowEnd?: number;
  initialWhatsappInstanceId?: string | null;
  onSave: (tags: string[], status: string, sendWindowEnabled: boolean, sendWindowStart: number, sendWindowEnd: number, whatsappInstanceId: string | null) => void;
}

export function FlowConfigModal({
  open,
  onClose,
  flowId,
  initialTags = [],
  initialStatus = "DRAFT",
  initialSendWindowEnabled = false,
  initialSendWindowStart = 8,
  initialSendWindowEnd = 21,
  initialWhatsappInstanceId = null,
  onSave,
}: FlowConfigModalProps) {
  const { user } = useAuthStore();
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("DRAFT");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendWindowEnabled, setSendWindowEnabled] = useState(false);
  const [sendWindowStart, setSendWindowStart] = useState(8);
  const [sendWindowEnd, setSendWindowEnd] = useState(21);
  const [whatsappInstanceId, setWhatsappInstanceId] = useState<string>("ALL");
  const [instances, setInstances] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setTags(initialTags);
      setStatus(initialStatus);
      setSendWindowEnabled(initialSendWindowEnabled);
      setSendWindowStart(initialSendWindowStart);
      setSendWindowEnd(initialSendWindowEnd);
      setWhatsappInstanceId(initialWhatsappInstanceId || "ALL");
      fetchTags();
      if (user?.companyId) {
        fetchInstances(user.companyId);
      }
    }
  }, [open, initialTags, initialStatus, initialSendWindowEnabled, initialSendWindowStart, initialSendWindowEnd, initialWhatsappInstanceId, user?.companyId]);

  const fetchTags = async () => {
    try {
      const resTags = await tagApi.getAll();
      setAvailableTags(resTags);
    } catch (error) {
      console.error("Error fetching tags", error);
      toast.error("Erro ao carregar tags disponíveis.");
    }
  };

  const fetchInstances = async (companyId: string) => {
    try {
      const response = await whatsappApi.getInstances(companyId);
      if (response && Array.isArray(response.data)) {
        setInstances(response.data);
      }
    } catch (error) {
      console.error("Error fetching instances", error);
      toast.error("Erro ao carregar WhatsApps conectados.");
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await api.put(`/flows/${flowId}`, {
        autoTags: tags,
        status: status,
        sendWindowEnabled,
        sendWindowStart,
        sendWindowEnd,
        whatsappInstanceId: whatsappInstanceId === "ALL" ? null : whatsappInstanceId,
      });
      toast.success("Configuração do fluxo salva com sucesso.");
      onSave(tags, status, sendWindowEnabled, sendWindowStart, sendWindowEnd, whatsappInstanceId === "ALL" ? null : whatsappInstanceId);
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
      <DialogContent className="sm:max-w-[480px]">
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

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <Label>Conexão WhatsApp</Label>
            </div>
            <Select
              value={whatsappInstanceId}
              onValueChange={setWhatsappInstanceId}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma conexão..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Divisão Inteligente (Todas as Conexões)
                </SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.displayName || instance.instanceName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione "Divisão Inteligente" para distribuir os disparos e reduzir risco de bloqueio, 
              ou fixe uma central específica para este fluxo.
            </p>
          </div>

          {/* Janela de envio por fuso horário */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label className="text-base cursor-pointer" htmlFor="flow-send-window-switch">
                    Janela de envio por fuso horário
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Dispara apenas dentro do horário local do contato (detectado pelo DDD)
                  </p>
                </div>
              </div>
              <Switch
                id="flow-send-window-switch"
                checked={sendWindowEnabled}
                onCheckedChange={setSendWindowEnabled}
                disabled={isSubmitting}
              />
            </div>

            {sendWindowEnabled && (
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Das</Label>
                  <Select
                    value={String(sendWindowStart)}
                    onValueChange={(v) => setSendWindowStart(Number(v))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">até</Label>
                  <Select
                    value={String(sendWindowEnd)}
                    onValueChange={(v) => setSendWindowEnd(Number(v))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  (hora local)
                </Label>
              </div>
            )}
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
