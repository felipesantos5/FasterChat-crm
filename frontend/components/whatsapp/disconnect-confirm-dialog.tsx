"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Smartphone, XCircle } from "lucide-react";

interface DisconnectConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  instanceName: string;
  phoneNumber?: string | null;
  isDeleting?: boolean;
}

export function DisconnectConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  instanceName,
  phoneNumber,
  isDeleting = false,
}: DisconnectConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-full ${isDeleting ? 'bg-red-100 dark:bg-red-900/20' : 'bg-yellow-100 dark:bg-yellow-900/20'}`}>
              {isDeleting ? (
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>
            <div>
              <DialogTitle className="text-left">
                {isDeleting ? 'Excluir Instância' : 'Desconectar WhatsApp'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left pt-2">
            {isDeleting ? (
              <>
                Você está prestes a <strong className="text-destructive">excluir permanentemente</strong> a instância do WhatsApp:
              </>
            ) : (
              <>
                Você está prestes a desconectar a instância do WhatsApp:
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Card com informações da instância */}
        <div className="my-4 p-4 rounded-lg border bg-muted/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-background">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{instanceName}</p>
              {phoneNumber && (
                <p className="text-sm text-muted-foreground mt-1">
                  Telefone: {phoneNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Avisos */}
        <div className="space-y-3 text-sm">
          {isDeleting ? (
            <>
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Esta ação não pode ser desfeita.</strong> Todos os dados desta instância serão removidos permanentemente.
                </p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0"></span>
                <p>
                  O WhatsApp será desconectado automaticamente
                </p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0"></span>
                <p>
                  Você precisará escanear um novo QR Code para reconectar
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0"></span>
                <p>
                  Você não receberá mais mensagens nesta instância
                </p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="block w-1 h-1 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0"></span>
                <p>
                  Você pode reconectar escaneando o QR Code novamente
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="sm:mr-2"
          >
            Cancelar
          </Button>
          <Button
            variant={isDeleting ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {isDeleting ? (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Excluir Permanentemente
              </>
            ) : (
              'Confirmar Desconexão'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
