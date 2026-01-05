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
import { Switch } from "@/components/ui/switch";
import {
  CustomerAddress,
  CreateCustomerAddressData,
  UpdateCustomerAddressData,
} from "@/types/customer-address";

const addressSchema = z.object({
  label: z.string().min(1, "Rótulo é obrigatório"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "Estado é obrigatório").max(2, "Use a sigla do estado"),
  zipCode: z.string().min(8, "CEP inválido").max(9, "CEP inválido"),
  isDefault: z.boolean().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface AddressFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerAddressData | UpdateCustomerAddressData) => Promise<void>;
  address?: CustomerAddress;
}

export function AddressFormModal({
  open,
  onClose,
  onSubmit,
  address,
}: AddressFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zipCode: "",
      isDefault: false,
    },
  });

  const isDefault = watch("isDefault");

  useEffect(() => {
    if (address) {
      reset({
        label: address.label,
        street: address.street,
        number: address.number,
        complement: address.complement || "",
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        isDefault: address.isDefault,
      });
    } else {
      reset({
        label: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zipCode: "",
        isDefault: false,
      });
    }
  }, [address, reset]);

  const handleFormSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit({
        ...data,
        complement: data.complement || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Erro ao salvar endereço. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setValue("street", data.logradouro || "");
        setValue("neighborhood", data.bairro || "");
        setValue("city", data.localidade || "");
        setValue("state", data.uf || "");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address ? "Editar Endereço" : "Novo Endereço"}
          </DialogTitle>
          <DialogDescription>
            {address
              ? "Atualize as informações do endereço"
              : "Adicione um novo endereço para o cliente"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">
                Rótulo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                {...register("label")}
                placeholder="Ex: Casa, Trabalho, Entrega"
                disabled={isSubmitting}
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">
                CEP <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zipCode"
                {...register("zipCode")}
                placeholder="00000-000"
                disabled={isSubmitting}
                onBlur={(e) => fetchAddressByCep(e.target.value)}
              />
              {errors.zipCode && (
                <p className="text-sm text-destructive">{errors.zipCode.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3 space-y-2">
              <Label htmlFor="street">
                Rua <span className="text-destructive">*</span>
              </Label>
              <Input
                id="street"
                {...register("street")}
                placeholder="Nome da rua"
                disabled={isSubmitting}
              />
              {errors.street && (
                <p className="text-sm text-destructive">{errors.street.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="number">
                Número <span className="text-destructive">*</span>
              </Label>
              <Input
                id="number"
                {...register("number")}
                placeholder="123"
                disabled={isSubmitting}
              />
              {errors.number && (
                <p className="text-sm text-destructive">{errors.number.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              {...register("complement")}
              placeholder="Apto, Bloco, etc."
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="neighborhood">
                Bairro <span className="text-destructive">*</span>
              </Label>
              <Input
                id="neighborhood"
                {...register("neighborhood")}
                placeholder="Bairro"
                disabled={isSubmitting}
              />
              {errors.neighborhood && (
                <p className="text-sm text-destructive">{errors.neighborhood.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">
                Cidade <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                {...register("city")}
                placeholder="Cidade"
                disabled={isSubmitting}
              />
              {errors.city && (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">
                Estado <span className="text-destructive">*</span>
              </Label>
              <Input
                id="state"
                {...register("state")}
                placeholder="SP"
                maxLength={2}
                disabled={isSubmitting}
              />
              {errors.state && (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setValue("isDefault", checked)}
              disabled={isSubmitting}
            />
            <Label htmlFor="isDefault">Definir como endereço principal</Label>
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
                : address
                ? "Salvar Alterações"
                : "Adicionar Endereço"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
