"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, TrendingUp } from "lucide-react";
import { pipelineApi } from "@/lib/pipeline";
import { toast } from "react-hot-toast";

interface DealValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  customerId: string;
  stageId: string;
  companyId: string;
  onSuccess?: () => void;
}

export function DealValueModal({
  open,
  onOpenChange,
  customerName,
  customerId,
  stageId,
  companyId,
  onSuccess,
}: DealValueModalProps) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (raw: string) => {
    // Remove tudo que não é número
    const numbers = raw.replace(/\D/g, "");
    if (!numbers) return "";
    // Converte para centavos e formata
    const cents = parseInt(numbers);
    return (cents / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setValue(formatted);
  };

  const parseValue = (formatted: string): number => {
    if (!formatted) return 0;
    // Remove pontos de milhar e troca vírgula por ponto
    return parseFloat(formatted.replace(/\./g, "").replace(",", "."));
  };

  const handleSubmit = async () => {
    const numericValue = parseValue(value);
    if (numericValue <= 0) {
      toast.error("Informe um valor válido para a venda");
      return;
    }

    setIsSubmitting(true);
    try {
      await pipelineApi.createDealValue(companyId, {
        customerId,
        stageId,
        value: numericValue,
        notes: notes || undefined,
      });
      toast.success("Valor da venda registrado com sucesso!");
      setValue("");
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Error creating deal value:", err);
      toast.error("Erro ao registrar valor da venda");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setValue("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-200 dark:shadow-green-900/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">Venda Fechada! 🎉</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Registre o valor da venda de <span className="font-semibold text-gray-700 dark:text-gray-300">{customerName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="deal-value" className="text-sm font-semibold">
              Valor da Venda (R$)
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="deal-value"
                placeholder="0,00"
                value={value}
                onChange={handleValueChange}
                className="pl-9 text-lg font-bold h-12"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal-notes" className="text-sm font-semibold">
              Observações <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="deal-notes"
              placeholder="Ex: Venda de 3 unidades, pagamento à vista..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-gray-500"
          >
            Pular
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !value}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm"
          >
            {isSubmitting ? "Registrando..." : "Registrar Venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
