"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_PAGES } from "@/types/collaborator";
import { toast } from "sonner";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  cargo: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteDataWithPermissions extends InviteFormData {
  permissions: { page: string; canView: boolean; canEdit: boolean }[];
}

export function InviteCollaboratorModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InviteDataWithPermissions) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const togglePage = (page: string) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(page)) {
      newSet.delete(page);
    } else {
      newSet.add(page);
    }
    setSelectedPages(newSet);
  };

  const handleFormSubmit = async (data: InviteFormData) => {
    if (selectedPages.size === 0) {
      toast.error('Selecione ao menos uma página');
      return;
    }

    setIsSubmitting(true);
    try {
      const permissions = Array.from(selectedPages).map(page => ({
        page,
        canView: true,
        canEdit: true,
      }));

      await onSubmit({ ...data, permissions });
      reset();
      setSelectedPages(new Set());
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar Colaborador</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input id="name" {...register("name")} disabled={isSubmitting} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input id="email" type="email" {...register("email")} disabled={isSubmitting} />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" {...register("cargo")} disabled={isSubmitting} placeholder="Ex: Vendedor, Atendente, etc" />
          </div>

          <div className="space-y-2">
            <Label>
              Permissões <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground">
              Selecione quais páginas este colaborador poderá acessar
            </p>
            <div className="grid gap-2 mt-2">
              {PERMISSION_PAGES.map((page) => (
                <div key={page.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={page.value}
                    checked={selectedPages.has(page.value)}
                    onCheckedChange={() => togglePage(page.value)}
                  />
                  <Label htmlFor={page.value} className="cursor-pointer">
                    {page.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedPages.size === 0 && (
              <p className="text-sm text-destructive">Selecione ao menos uma página</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || selectedPages.size === 0}>
              {isSubmitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
