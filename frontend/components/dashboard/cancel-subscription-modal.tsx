"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, X, Check, ChevronRight, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAuthStore } from "@/lib/store/auth.store";

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CANCEL_REASONS = [
  { value: "price", label: "O preço está alto demais para mim" },
  { value: "usage", label: "Não uso o suficiente para justificar" },
  { value: "competitor", label: "Encontrei outro produto" },
  { value: "closed", label: "Minha empresa encerrou as atividades" },
  { value: "missing_features", label: "Faltam funcionalidades que preciso" },
  { value: "other", label: "Outro motivo" },
];

const PLAN_FEATURES_LOSS: Record<string, string[]> = {
  ESCALA_TOTAL: [
    "WhatsApps ilimitados conectados",
    "Geração de imagem nativa por IA",
    "Integração com Google Agenda",
    "Atendente Virtual com IA avançada",
    "Disparador de campanhas ilimitado",
    "Rastreamento inteligente de links",
    "CRM completo com funil de vendas",
  ],
  NEGOCIOS: [
    "Até 3 WhatsApps conectados",
    "Atendente Virtual com IA",
    "Disparador de campanhas",
    "Rastreamento inteligente de links",
    "CRM completo com funil de vendas",
  ],
  INICIAL: [
    "1 WhatsApp conectado",
    "Atendente Virtual com IA",
    "CRM completo com funil de vendas",
  ],
};

export function CancelSubscriptionModal({ isOpen, onClose }: CancelSubscriptionModalProps) {
  const { user } = useAuthStore();
  const { currentPlanName } = usePlanFeatures();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const [confirmText, setConfirmText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const featuresToLose = PLAN_FEATURES_LOSS[user?.plan ?? "INICIAL"] ?? PLAN_FEATURES_LOSS.INICIAL;
  const canProceedStep1 = reason !== "" && details.trim().length >= 30;
  const canProceedStep3 = confirmText === "CANCELAR";

  const handleClose = () => {
    setStep(1);
    setReason("");
    setDetails("");
    setConfirmText("");
    onClose();
  };

  const handleFinalCancel = async () => {
    try {
      setLoading(true);
      const response = await api.post("/stripe/portal", {
        returnUrl: window.location.href,
      });
      if (response.data?.data?.url) {
        window.location.href = response.data.data.url;
      } else {
        toast.error("Erro ao acessar portal de cancelamento");
      }
    } catch {
      toast.error("Erro ao processar solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[95vw]">
        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  step > s
                    ? "bg-green-500 text-white"
                    : step === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-400"
                )}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 3 && <div className={cn("h-px w-8 transition-colors", step > s ? "bg-green-400" : "bg-gray-200")} />}
            </div>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">Etapa {step} de 3</span>
        </div>

        {/* ETAPA 1 — Motivo */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900">Antes de cancelar...</DialogTitle>
              <DialogDescription>
                Precisamos entender o motivo para melhorar nosso produto.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Por que você quer cancelar? <span className="text-red-500">*</span></Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Nos conte mais sobre o que aconteceu <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  placeholder="Descreva com mais detalhes o motivo do cancelamento (mínimo 30 caracteres)..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="resize-none h-24"
                  maxLength={500}
                />
                <p className={cn("text-xs text-right", details.trim().length >= 30 ? "text-green-600" : "text-muted-foreground")}>
                  {details.trim().length}/30 caracteres mínimos
                </p>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Manter minha conta
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  Continuar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ETAPA 2 — O que você vai perder */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Você vai perder tudo isso
              </DialogTitle>
              <DialogDescription>
                Ao cancelar o plano <span className="font-semibold text-gray-700">{currentPlanName}</span>, você perde acesso imediato a:
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-2">
              {featuresToLose.map((feature) => (
                <div key={feature} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ Todos os seus dados (contatos, conversas, funis) são mantidos por 30 dias após o cancelamento. Após isso, serão excluídos permanentemente.
              </p>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Quero continuar
              </Button>
              <Button
                onClick={() => setStep(3)}
                variant="ghost"
                className="flex-1 text-gray-500 hover:text-gray-700 text-sm"
              >
                Mesmo assim, cancelar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}

        {/* ETAPA 3 — Confirmação final */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Confirmação final
              </DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. Para confirmar o cancelamento, digite{" "}
                <span className="font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded font-mono">CANCELAR</span>{" "}
                no campo abaixo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Digite CANCELAR para confirmar</Label>
                <Input
                  placeholder="CANCELAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className={cn(
                    "font-mono tracking-widest transition-colors",
                    canProceedStep3 ? "border-red-500 focus-visible:ring-red-500" : ""
                  )}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-gray-500">Você será redirecionado para o portal da Stripe para concluir o cancelamento. O acesso ao plano permanece ativo até o fim do período já pago.</p>
              </div>

              <div className="flex justify-between gap-3 pt-1">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Não cancelar
                </Button>
                <Button
                  onClick={handleFinalCancel}
                  disabled={!canProceedStep3 || loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Ir para cancelamento"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
