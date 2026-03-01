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
import { TagSelector } from "./tag-selector";
import { Customer, CreateCustomerData, UpdateCustomerData } from "@/types/customer";
import { Tag } from "@/lib/tag";
import { customFieldApi } from "@/lib/custom-field";
import { CustomFieldDefinition } from "@/types/custom-field";

const customerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  phone: z.string().min(8, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerData | UpdateCustomerData) => Promise<void>;
  customer?: Customer;
  availableTags: Tag[];
  onTagCreated?: () => void;
}

export function CustomerFormModal({
  open,
  onClose,
  onSubmit,
  customer,
  availableTags,
  onTagCreated,
}: CustomerFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      tags: [],
      notes: "",
    },
  });

  useEffect(() => {
    customFieldApi.getDefinitions().then(setCustomFields).catch(() => {});
  }, []);

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        notes: customer.notes || "",
      });
      setTags(customer.tags || []);

      // Pre-populate custom field values
      const vals: Record<string, string> = {};
      customer.customFieldValues?.forEach((v) => {
        vals[v.fieldId] = v.value ?? "";
      });
      setCustomValues(vals);
    } else {
      reset({
        name: "",
        phone: "",
        email: "",
        notes: "",
      });
      setTags([]);
      setCustomValues({});
    }
  }, [customer, reset]);

  useEffect(() => {
    setValue("tags", tags);
  }, [tags, setValue]);

  const handleFormSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const customFieldValues = customFields
        .map((f) => ({ fieldId: f.id, value: customValues[f.id] ?? null }))
        .filter((v) => v.value !== null && v.value !== "" || false);

      await onSubmit({
        ...data,
        tags: tags,
        email: data.email || undefined,
        customFieldValues: customFieldValues.length > 0 ? customFieldValues : undefined,
      } as any);
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Erro ao salvar cliente. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customer ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {customer
              ? "Atualize as informações do cliente"
              : "Adicione um novo cliente ao sistema"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Nome completo"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Telefone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+55 11 99999-9999"
              disabled={isSubmitting}
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="cliente@email.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagSelector
              value={tags}
              onChange={setTags}
              availableTags={availableTags}
              placeholder="Selecionar tags..."
              disabled={isSubmitting}
              onTagCreated={() => {
                onTagCreated?.();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Selecione tags existentes ou crie novas para organizar seus clientes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Observações sobre o cliente..."
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground">Campos Personalizados</p>
              {customFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={`cf-${field.id}`}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id={`cf-${field.id}`}
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={customValues[field.id] ?? ""}
                    onChange={(e) =>
                      setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
              ))}
            </div>
          )}

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
                : customer
                  ? "Salvar Alterações"
                  : "Criar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
