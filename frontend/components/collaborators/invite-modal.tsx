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
import { Badge } from "@/components/ui/badge";
import { PERMISSION_GROUPS } from "@/types/collaborator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const inviteSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  cargo: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface PagePermission {
  canView: boolean;
  canEdit: boolean;
}

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
  const [pagePerms, setPagePerms] = useState<Record<string, PagePermission>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({ resolver: zodResolver(inviteSchema) });

  const selectedCount = Object.values(pagePerms).filter((p) => p.canView).length;

  const toggleView = (page: string) => {
    setPagePerms((prev) => {
      const current = prev[page];
      if (current?.canView) {
        // Desativa page inteira
        const next = { ...prev };
        delete next[page];
        return next;
      }
      return { ...prev, [page]: { canView: true, canEdit: false } };
    });
  };

  const toggleEdit = (page: string) => {
    setPagePerms((prev) => {
      const current = prev[page];
      if (!current?.canView) return prev; // precisa de view primeiro
      return { ...prev, [page]: { canView: true, canEdit: !current.canEdit } };
    });
  };

  const toggleGroup = (groupPages: string[]) => {
    const allSelected = groupPages.every((p) => pagePerms[p]?.canView);
    setPagePerms((prev) => {
      const next = { ...prev };
      if (allSelected) {
        groupPages.forEach((p) => delete next[p]);
      } else {
        groupPages.forEach((p) => {
          if (!next[p]?.canView) next[p] = { canView: true, canEdit: false };
        });
      }
      return next;
    });
  };

  const handleFormSubmit = async (data: InviteFormData) => {
    if (selectedCount === 0) {
      toast.error("Selecione ao menos uma permissão");
      return;
    }
    setIsSubmitting(true);
    try {
      const permissions = Object.entries(pagePerms)
        .filter(([, p]) => p.canView)
        .map(([page, p]) => ({ page, canView: true, canEdit: p.canEdit }));

      await onSubmit({ ...data, permissions });
      reset();
      setPagePerms({});
    } catch {
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

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          {/* Dados do colaborador */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome <span className="text-destructive">*</span></Label>
              <Input id="name" {...register("name")} disabled={isSubmitting} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" {...register("cargo")} disabled={isSubmitting} placeholder="Ex: Vendedor, Atendente…" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input id="email" type="email" {...register("email")} disabled={isSubmitting} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Permissões agrupadas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Permissões <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Defina quais seções este colaborador pode acessar e se pode editar.
                </p>
              </div>
              {selectedCount > 0 && (
                <Badge variant="secondary">{selectedCount} selecionada{selectedCount !== 1 ? 's' : ''}</Badge>
              )}
            </div>

            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => {
                const groupPageValues = group.pages.map((p) => p.value);
                const allGroupSelected = groupPageValues.every((p) => pagePerms[p]?.canView);

                return (
                  <div key={group.label} className="border rounded-xl overflow-hidden">
                    {/* Cabeçalho do grupo */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
                      <span className="text-sm font-semibold text-gray-700">{group.label}</span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupPageValues)}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {allGroupSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    </div>

                    {/* Cabeçalho das colunas */}
                    <div className="grid grid-cols-[1fr_72px_64px] gap-2 px-4 py-1.5 bg-muted/20 border-b">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Seção</span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Ver</span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide text-center">Editar</span>
                    </div>

                    {/* Linhas de permissão */}
                    {group.pages.map((page, idx) => {
                      const perm = pagePerms[page.value];
                      const isActive = perm?.canView ?? false;
                      const canEdit = perm?.canEdit ?? false;

                      return (
                        <div
                          key={page.value}
                          className={cn(
                            "grid grid-cols-[1fr_72px_64px] gap-2 items-center px-4 py-3 transition-colors",
                            idx !== group.pages.length - 1 && "border-b border-dashed",
                            isActive ? "bg-green-50/40" : "bg-white hover:bg-muted/10"
                          )}
                        >
                          <div>
                            <p className={cn("text-sm font-medium", isActive ? "text-gray-900" : "text-gray-500")}>
                              {page.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                              {page.description}
                            </p>
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={isActive}
                              onCheckedChange={() => toggleView(page.value)}
                              className={isActive ? "border-green-500 data-[state=checked]:bg-green-500" : ""}
                            />
                          </div>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={canEdit}
                              disabled={!isActive}
                              onCheckedChange={() => toggleEdit(page.value)}
                              className={canEdit ? "border-blue-500 data-[state=checked]:bg-blue-500" : ""}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {selectedCount === 0 && (
              <p className="text-xs text-destructive">Selecione ao menos uma seção</p>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
            <strong>Ver</strong> — permite visualizar a seção. <strong>Editar</strong> — permite criar, editar e excluir registros dentro da seção.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || selectedCount === 0}>
              {isSubmitting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
