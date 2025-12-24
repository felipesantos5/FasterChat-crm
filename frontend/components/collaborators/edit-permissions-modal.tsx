"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_PAGES, Collaborator } from "@/types/collaborator";

export function EditPermissionsModal({
  open,
  collaborator,
  onClose,
  onSubmit,
}: {
  open: boolean;
  collaborator: Collaborator;
  onClose: () => void;
  onSubmit: (permissions: any[]) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (collaborator) {
      const pages = new Set(collaborator.permissions.map(p => p.page));
      setSelectedPages(pages);
    }
  }, [collaborator]);

  const togglePage = (page: string) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(page)) {
      newSet.delete(page);
    } else {
      newSet.add(page);
    }
    setSelectedPages(newSet);
  };

  const handleSubmit = async () => {
    if (selectedPages.size === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const permissions = Array.from(selectedPages).map(page => ({
        page,
        canView: true,
        canEdit: false,
      }));

      await onSubmit(permissions);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Permissões - {collaborator.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Permissões de Acesso</Label>
            <p className="text-sm text-muted-foreground">
              Selecione quais páginas este colaborador poderá acessar
            </p>
            <div className="grid gap-2 mt-2">
              {PERMISSION_PAGES.map((page) => (
                <div key={page.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`edit-${page.value}`}
                    checked={selectedPages.has(page.value)}
                    onCheckedChange={() => togglePage(page.value)}
                  />
                  <Label htmlFor={`edit-${page.value}`} className="cursor-pointer">
                    {page.label}
                  </Label>
                </div>
              ))}
            </div>
            {selectedPages.size === 0 && (
              <p className="text-sm text-destructive">Selecione ao menos uma página</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedPages.size === 0}>
            {isSubmitting ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
