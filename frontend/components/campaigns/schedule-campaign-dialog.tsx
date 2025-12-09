"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarClock } from "lucide-react";
import { Campaign } from "@/types/campaign";
import { campaignApi } from "@/lib/campaign";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduleCampaignDialogProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ScheduleCampaignDialog({
  campaign,
  isOpen,
  onClose,
  onSuccess,
}: ScheduleCampaignDialogProps) {
  const [loading, setLoading] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);

  const handleSchedule = async () => {
    if (!campaign || !scheduledDate) return;

    // Validação: deve ser no futuro
    const now = new Date();
    if (scheduledDate <= now) {
      toast.error("A data de agendamento deve ser no futuro");
      return;
    }

    try {
      setLoading(true);

      await campaignApi.schedule(campaign.id, scheduledDate.toISOString());

      toast.success(
        `📅 Campanha agendada para ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
      );

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Error scheduling campaign:", error);
      toast.error(error.response?.data?.message || "Erro ao agendar campanha");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setScheduledDate(undefined);
      onClose();
    }
  };

  if (!campaign) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Agendar Campanha
          </DialogTitle>
          <DialogDescription>
            Selecione a data e hora para disparar a campanha automaticamente.
            O fuso horário usado é o de Brasília (GMT-3).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Info da Campanha */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Campanha:</span>{" "}
              <span className="font-medium">{campaign.name}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Tags alvo:</span>{" "}
              <span className="font-medium">{campaign.targetTags.join(", ")}</span>
            </div>
          </div>

          {/* Date Time Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Data e Hora do Disparo *
            </label>
            <DateTimePicker
              value={scheduledDate}
              onChange={setScheduledDate}
              placeholder="Selecione quando disparar"
              minDate={new Date()}
            />
          </div>

          {/* Info */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              A campanha será disparada automaticamente na data e hora selecionadas.
              Você pode cancelar o agendamento antes do horário programado.
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
          <Button
            onClick={handleSchedule}
            disabled={loading || !scheduledDate}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Agendando...
              </>
            ) : (
              <>
                <CalendarClock className="h-4 w-4 mr-2" />
                Agendar Campanha
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
