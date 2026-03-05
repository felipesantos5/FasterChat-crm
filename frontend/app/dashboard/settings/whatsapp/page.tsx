"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeModal } from "@/components/whatsapp/qr-code-modal";
import { DisconnectConfirmDialog } from "@/components/whatsapp/disconnect-confirm-dialog";
import { whatsappApi } from "@/lib/whatsapp";
import { WhatsAppInstance, WhatsAppStatus } from "@/types/whatsapp";
import { Loader2, Smartphone, CheckCircle2, XCircle, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";

export default function WhatsAppSettingsPage() {
  return (
    <ProtectedPage requiredPage="WHATSAPP_CONFIG">
      <WhatsAppSettingsPageContent />
    </ProtectedPage>
  );
}

function WhatsAppSettingsPageContent() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasError, handleError, clearError } = useErrorHandler();
  const [creating, setCreating] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<{ [key: string]: boolean }>({});

  // Estados para os modais de confirmação
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToAction, setInstanceToAction] = useState<WhatsAppInstance | null>(null);

  // Estados de estratégia de envio
  const [strategy, setStrategy] = useState<"RANDOM" | "SPECIFIC">("RANDOM");
  const [defaultInstanceId, setDefaultInstanceId] = useState<string | null>(null);
  const [companyPlan, setCompanyPlan] = useState<string>("INICIAL");
  const [savingStrategy, setSavingStrategy] = useState(false);

  // Obtém o companyId do usuário logado (você pode ajustar conforme sua implementação)
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega as instâncias
  const loadInstances = useCallback(async () => {
    try {
      clearError();
      const companyId = getCompanyId();
      if (!companyId) {
        handleError("Empresa não encontrada");
        return;
      }

      const response = await whatsappApi.getInstances(companyId);
      setInstances(response.data);

      try {
        const strategyResponse = await whatsappApi.getStrategy();
        if (strategyResponse.data) {
          setStrategy(strategyResponse.data.whatsappStrategy || "RANDOM");
          setDefaultInstanceId(strategyResponse.data.defaultWhatsappInstanceId || null);
          setCompanyPlan(strategyResponse.data.plan || "INICIAL");
        }
      } catch (err) {
        console.error("Error loading strategy:", err);
      }
    } catch (err: any) {
      console.error("Error loading instances:", err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  useEffect(() => {
    loadInstances();

    // Polling: Atualiza status a cada 10 segundos (reduzido de 5s)
    // Útil quando webhook não funciona (Evolution em Docker)
    // IMPORTANTE: Pausa quando modal está aberto para evitar conflito
    const interval = setInterval(() => {
      // Só faz polling se o modal NÃO estiver aberto
      if (!qrModalOpen) {
        console.log("[WhatsApp Settings] Polling instances status...");
        loadInstances();
      } else {
        console.log("[WhatsApp Settings] Modal aberto, pulando polling");
      }
    }, 10000); // Aumentado de 5s para 10s

    return () => clearInterval(interval);
  }, [qrModalOpen]); // Adiciona qrModalOpen como dependência

  // Cria uma nova instância
  const handleCreateInstance = async () => {
    try {
      setCreating(true);
      setOperationError(null);

      // Limites por plano
      const limits: { [key: string]: number } = {
        'INICIAL': 1,
        'NEGOCIOS': 3,
        'ESCALA_TOTAL': 999
      };

      const limit = limits[companyPlan] || 1;
      if (instances.length >= limit) {
        toast.error(`Sua conta atingiu o limite de ${limit} ${limit === 1 ? 'instância' : 'instâncias'} para o plano ${companyPlan}.`);
        setOperationError(`Sua conta atingiu o limite de ${limit} ${limit === 1 ? 'instância' : 'instâncias'} para o plano ${companyPlan}.`);
        return;
      }

      const companyId = getCompanyId();
      if (!companyId) {
        setOperationError("Empresa não encontrada");
        return;
      }

      const response = await whatsappApi.createInstance(companyId);
      setSelectedInstanceId(response.data.id);
      setQrModalOpen(true);

      // Recarrega a lista
      await loadInstances();
      toast.success("Instância criada com sucesso!");
    } catch (err: any) {
      console.error("Error creating instance:", err);
      const message = err.response?.data?.message || "Erro ao criar instância";
      setOperationError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  // Abre o modal de confirmação de desconexão
  const openDisconnectDialog = (instance: WhatsAppInstance) => {
    setInstanceToAction(instance);
    setDisconnectDialogOpen(true);
  };

  // Desconecta uma instância
  const handleDisconnect = async () => {
    if (!instanceToAction) return;

    try {
      await whatsappApi.disconnectInstance(instanceToAction.id);
      await loadInstances();
    } catch (err: any) {
      console.error("Error disconnecting:", err);
      setOperationError(err.response?.data?.message || "Erro ao desconectar");
    }
  };

  // Abre o modal de confirmação de exclusão
  const openDeleteDialog = (instance: WhatsAppInstance) => {
    setInstanceToAction(instance);
    setDeleteDialogOpen(true);
  };

  // Deleta uma instância
  const handleDelete = async () => {
    if (!instanceToAction) return;

    try {
      await whatsappApi.deleteInstance(instanceToAction.id);
      await loadInstances();
    } catch (err: any) {
      console.error("Error deleting:", err);
      setOperationError(err.response?.data?.message || "Erro ao deletar instância");
    }
  };

  // Abre o modal de QR Code
  const handleReconnect = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setQrModalOpen(true);
  };

  // Sincroniza status manualmente com Evolution API
  const handleSyncStatus = async (instanceId: string) => {
    setSyncing((prev) => ({ ...prev, [instanceId]: true }));
    try {
      await whatsappApi.syncStatus(instanceId);
      await loadInstances();
    } catch (err: any) {
      console.error("Error syncing status:", err);
      alert(err.response?.data?.message || "Erro ao sincronizar status");
    } finally {
      setSyncing((prev) => ({ ...prev, [instanceId]: false }));
    }
  };

  // Retorna o badge de status
  const getStatusBadge = (status: WhatsAppStatus) => {
    switch (status) {
      case WhatsAppStatus.CONNECTED:
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case WhatsAppStatus.CONNECTING:
        return (
          <Badge variant="secondary">
            <AlertCircle className="w-3 h-3 mr-1" />
            Conectando
          </Badge>
        );
      case WhatsAppStatus.DISCONNECTED:
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  if (loading && !instances.length) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return <LoadingErrorState resource="configurações do WhatsApp" onRetry={loadInstances} />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Operation Error Message */}
      {operationError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <p className="text-sm">{operationError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect WhatsApp Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Conectar WhatsApp
          </CardTitle>
          <CardDescription>Conecte sua conta do WhatsApp para enviar e receber mensagens através do CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">Uso do Plano: {companyPlan}</p>
                <p className="text-2xl font-bold">
                  {instances.length} / {companyPlan === 'ESCALA_TOTAL' ? '∞' : (companyPlan === 'NEGOCIOS' ? '3' : '1')}
                </p>
                <p className="text-xs text-muted-foreground">Instâncias de WhatsApp conectadas</p>
              </div>
              <Badge variant={instances.length >= (companyPlan === 'NEGOCIOS' ? 3 : (companyPlan === 'ESCALA_TOTAL' ? 999 : 1)) ? "destructive" : "secondary"}>
                {instances.length >= (companyPlan === 'NEGOCIOS' ? 3 : (companyPlan === 'ESCALA_TOTAL' ? 999 : 1)) ? "Limite Atingido" : "Disponível"}
              </Badge>
            </div>
            <Button
              onClick={handleCreateInstance}
              disabled={creating || instances.length >= (companyPlan === 'NEGOCIOS' ? 3 : (companyPlan === 'ESCALA_TOTAL' ? 999 : 1))}
              className="w-full sm:w-auto"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar WhatsApp
            </Button>
            {instances.length >= (companyPlan === 'NEGOCIOS' ? 3 : (companyPlan === 'ESCALA_TOTAL' ? 999 : 1)) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Aumente seu plano para conectar mais instâncias.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Select Strategy Card */}
      {instances.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Estratégia de Envio de Mensagens</CardTitle>
            <CardDescription>
              Quando uma mensagem for disparada para um contato novo (por IA, Fluxos Automáticos, ou manualmente), como o sistema deve escolher a instância de envio?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Modo de Distribuição</label>
              <select
                className="w-full p-2 border rounded-md"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as "RANDOM" | "SPECIFIC")}
              >
                <option value="RANDOM">Distribuir Aleatoriamente (Balancear entre as conectadas)</option>
                <option value="SPECIFIC">Sempre enviar através de uma Instância Específica</option>
              </select>
            </div>

            {strategy === "SPECIFIC" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Instância Padrão</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={defaultInstanceId || ""}
                  onChange={(e) => setDefaultInstanceId(e.target.value)}
                >
                  <option value="" disabled>Selecione uma instância...</option>
                  {instances.filter(i => i.status === WhatsAppStatus.CONNECTED).map(i => (
                    <option key={i.id} value={i.id}>{i.displayName || i.instanceName} ({i.phoneNumber || 'Sem número'})</option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={async () => {
                try {
                  setSavingStrategy(true);
                  await whatsappApi.updateStrategy(strategy, strategy === "SPECIFIC" ? defaultInstanceId : null);
                  toast.success("Estratégia salva com sucesso!");
                } catch (err: any) {
                  toast.error(err.response?.data?.message || "Erro ao salvar estratégia");
                } finally {
                  setSavingStrategy(false);
                }
              }}
              disabled={savingStrategy || (strategy === "SPECIFIC" && !defaultInstanceId)}
            >
              {savingStrategy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Estratégia
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instances List */}
      {instances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conexões Ativas</CardTitle>
            <CardDescription>Gerencie suas instâncias conectadas do WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {instances.map((instance) => (
                <div key={instance.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{instance.displayName || instance.instanceName}</p>
                      {getStatusBadge(instance.status)}
                    </div>
                    {instance.phoneNumber && <p className="text-sm text-muted-foreground">Número: {instance.phoneNumber}</p>}
                    {instance.connectedAt && (
                      <p className="text-sm text-muted-foreground">
                        Conectado desde: {new Date(instance.connectedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Criado em: {new Date(instance.createdAt).toLocaleString("pt-BR")}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botão de Sincronização Manual */}
                    <Button
                      onClick={() => handleSyncStatus(instance.id)}
                      variant="ghost"
                      size="sm"
                      disabled={syncing[instance.id]}
                      title="Sincronizar status com Evolution API"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing[instance.id] ? "animate-spin" : ""}`} />
                    </Button>

                    {instance.status === WhatsAppStatus.CONNECTED && (
                      <Button onClick={() => openDisconnectDialog(instance)} variant="outline" size="sm">
                        Desconectar
                      </Button>
                    )}

                    {instance.status === WhatsAppStatus.DISCONNECTED && (
                      <Button onClick={() => handleReconnect(instance.id)} variant="outline" size="sm">
                        Reconectar
                      </Button>
                    )}

                    {instance.status === WhatsAppStatus.CONNECTING && (
                      <Button onClick={() => handleReconnect(instance.id)} variant="outline" size="sm">
                        Ver QR Code
                      </Button>
                    )}

                    <Button onClick={() => openDeleteDialog(instance)} variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Smartphone className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma instância conectada ainda</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Modal */}
      {selectedInstanceId && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => {
            setQrModalOpen(false);
            setSelectedInstanceId(null);
          }}
          instanceId={selectedInstanceId}
          onSuccess={loadInstances}
          existingDisplayName={instances.find(i => i.id === selectedInstanceId)?.displayName}
        />
      )}

      {/* Disconnect Confirmation Dialog */}
      {instanceToAction && (
        <DisconnectConfirmDialog
          isOpen={disconnectDialogOpen}
          onClose={() => {
            setDisconnectDialogOpen(false);
            setInstanceToAction(null);
          }}
          onConfirm={handleDisconnect}
          instanceName={instanceToAction.displayName || instanceToAction.instanceName}
          phoneNumber={instanceToAction.phoneNumber}
          isDeleting={false}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {instanceToAction && (
        <DisconnectConfirmDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setInstanceToAction(null);
          }}
          onConfirm={handleDelete}
          instanceName={instanceToAction.displayName || instanceToAction.instanceName}
          phoneNumber={instanceToAction.phoneNumber}
          isDeleting={true}
        />
      )}
    </div>
  );
}
