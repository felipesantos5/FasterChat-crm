"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Calendar, AlertCircle } from "lucide-react";
import { googleCalendarApi, GoogleCalendarStatus } from "@/lib/google-calendar";

interface GoogleCalendarModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  currentStatus: GoogleCalendarStatus | null;
}

export function GoogleCalendarModal({
  open,
  onClose,
  onSuccess,
  companyId,
  currentStatus,
}: GoogleCalendarModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      const authUrl = await googleCalendarApi.getAuthUrl(companyId);

      // Abre a URL de autenticação na mesma aba (melhor UX)
      window.location.href = authUrl;
    } catch (err: any) {
      console.error("Error getting auth URL:", err);
      const errorMessage = err.response?.data?.message || err.message || "Erro ao iniciar conexão com Google Calendar";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Google Calendar? Os agendamentos não serão mais sincronizados.")) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await googleCalendarApi.disconnect(companyId);
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error disconnecting:", err);
      setError("Erro ao desconectar Google Calendar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const isConnected = currentStatus?.connected || false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </DialogTitle>
          <DialogDescription>
            {isConnected
              ? "Gerencie sua conexão com o Google Calendar"
              : "Conecte sua conta do Google para sincronizar agendamentos automaticamente"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isConnected ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Conectado com sucesso!</p>
                    {currentStatus?.email && (
                      <p className="text-sm">Conta: {currentStatus.email}</p>
                    )}
                    {currentStatus?.connectedAt && (
                      <p className="text-sm text-muted-foreground">
                        Conectado em: {new Date(currentStatus.connectedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Benefícios da integração:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Sincronização automática de agendamentos</li>
                  <li>Visualização de horários disponíveis</li>
                  <li>Atualização em tempo real</li>
                  <li>Evita conflitos de horário</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Você ainda não conectou sua conta do Google Calendar.
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Ao conectar, você poderá:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Sincronizar agendamentos automaticamente</li>
                  <li>Ver horários disponíveis em tempo real</li>
                  <li>Evitar conflitos de horário</li>
                  <li>Gerenciar tudo em um só lugar</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
          {isConnected ? (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Desconectar
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Conectar Google
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
