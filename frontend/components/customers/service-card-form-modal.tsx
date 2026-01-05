"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import {
  CustomerServiceCard,
  CreateCustomerServiceCardData,
  UpdateCustomerServiceCardData,
  ServiceCardStatus,
  SERVICE_CARD_STATUS_LABELS,
} from "@/types/customer-service-card";

const serviceCardSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  serviceDate: z.string().min(1, "Data do serviço é obrigatória"),
  rating: z.number().min(0).max(5).optional(),
  price: z.number().min(0).optional(),
  status: z.enum(["completed", "in_progress", "scheduled", "cancelled"]),
});

type ServiceCardFormData = z.infer<typeof serviceCardSchema>;

interface ServiceCardFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerServiceCardData | UpdateCustomerServiceCardData) => Promise<void>;
  serviceCard?: CustomerServiceCard;
}

export function ServiceCardFormModal({
  open,
  onClose,
  onSubmit,
  serviceCard,
}: ServiceCardFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ServiceCardFormData>({
    resolver: zodResolver(serviceCardSchema),
    defaultValues: {
      title: "",
      description: "",
      serviceDate: new Date().toISOString().split("T")[0],
      rating: 0,
      price: undefined,
      status: "scheduled",
    },
  });

  const status = watch("status");

  useEffect(() => {
    if (serviceCard) {
      reset({
        title: serviceCard.title,
        description: serviceCard.description,
        serviceDate: serviceCard.serviceDate.split("T")[0],
        rating: serviceCard.rating || 0,
        price: serviceCard.price || undefined,
        status: serviceCard.status,
      });
      setRating(serviceCard.rating || 0);
    } else {
      reset({
        title: "",
        description: "",
        serviceDate: new Date().toISOString().split("T")[0],
        rating: 0,
        price: undefined,
        status: "scheduled",
      });
      setRating(0);
    }
  }, [serviceCard, reset]);

  const handleFormSubmit = async (data: ServiceCardFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit({
        ...data,
        rating: rating || undefined,
        price: data.price || undefined,
        tags: [],
      });
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Erro ao salvar card. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRatingClick = (value: number) => {
    setRating(value);
    setValue("rating", value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {serviceCard ? "Editar Card de Serviço" : "Novo Card de Serviço"}
          </DialogTitle>
          <DialogDescription>
            {serviceCard
              ? "Atualize as informações do serviço"
              : "Registre um serviço realizado para este cliente"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Ex: Manutenção de ar-condicionado"
              disabled={isSubmitting}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Descreva o serviço realizado, observações importantes, etc."
              rows={4}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serviceDate">
                Data do Serviço <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serviceDate"
                type="date"
                {...register("serviceDate")}
                disabled={isSubmitting}
              />
              {errors.serviceDate && (
                <p className="text-sm text-destructive">{errors.serviceDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(value: ServiceCardStatus) => setValue("status", value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_CARD_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Valor (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...register("price", { valueAsNumber: true })}
                placeholder="0,00"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label>Avaliação</Label>
              <div className="flex items-center gap-1 pt-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleRatingClick(value)}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none"
                    disabled={isSubmitting}
                  >
                    <Star
                      className={`h-6 w-6 transition-colors ${
                        value <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRatingClick(0)}
                    className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={isSubmitting}
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Salvando..."
                : serviceCard
                ? "Salvar Alterações"
                : "Adicionar Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
