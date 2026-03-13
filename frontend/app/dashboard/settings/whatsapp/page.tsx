"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeModal } from "@/components/whatsapp/qr-code-modal";
import { DisconnectConfirmDialog } from "@/components/whatsapp/disconnect-confirm-dialog";
import { whatsappApi } from "@/lib/whatsapp";
import { WhatsAppInstance, WhatsAppStatus } from "@/types/whatsapp";
import { Loader2, Smartphone, CheckCircle2, XCircle, AlertCircle, Trash2, RefreshCw, Plus, Wifi, WifiOff, QrCode } from "lucide-react";
import { toast } from "sonner";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";
import { useAuthStore } from "@/lib/store/auth.store";
import phoneTutorial from "@/assets/phone-whatsapp-tutorial.png";

export default function WhatsAppSettingsPage() {
  return (
    <ProtectedPage requiredPage="WHATSAPP_CONFIG">
      <WhatsAppSettingsPageContent />
    </ProtectedPage>
  );
}

function WhatsAppSettingsPageContent() {
  const { user } = useAuthStore();
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
  const [companyPlan, setCompanyPlan] = useState<string | null>(null);
  const [savingStrategy, setSavingStrategy] = useState(false);

  // Plano resolvido: usa o retorno da API (autoritativo) ou o plano do auth store (imediato do localStorage)
  const resolvedPlan = companyPlan ?? user?.plan ?? null;
  const PLAN_LIMITS: Record<string, number> = { FREE: 1, INICIAL: 1, NEGOCIOS: 3, ESCALA_TOTAL: 999 };
  const instanceLimit = resolvedPlan ? (PLAN_LIMITS[resolvedPlan] ?? 1) : null;
  const limitDisplay = resolvedPlan === 'ESCALA_TOTAL' ? '∞' : (instanceLimit?.toString() ?? '—');

  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

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
          setCompanyPlan(strategyResponse.data.plan || "FREE");
        }
      } catch (err) {
        console.error("Error loading strategy:", err);
      }
    } catch (err: unknown) {
      console.error("Error loading instances:", err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  useEffect(() => {
    loadInstances();

    const interval = setInterval(() => {
      if (!qrModalOpen) {
        loadInstances();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [qrModalOpen]);

  const handleCreateInstance = async () => {
    try {
      setCreating(true);
      setOperationError(null);

      if (instanceLimit === null) {
        toast.error("Aguarde o carregamento das informações do plano.");
        return;
      }

      if (instances.length >= instanceLimit) {
        const msg = `Sua conta atingiu o limite de ${instanceLimit} ${instanceLimit === 1 ? 'instância' : 'instâncias'} para o plano ${resolvedPlan}.`;
        toast.error(msg);
        setOperationError(msg);
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

      await loadInstances();
      toast.success("Instância criada com sucesso!");
    } catch (err: unknown) {
      console.error("Error creating instance:", err);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao criar instância";
      setOperationError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const openDisconnectDialog = (instance: WhatsAppInstance) => {
    setInstanceToAction(instance);
    setDisconnectDialogOpen(true);
  };

  const handleDisconnect = async () => {
    if (!instanceToAction) return;
    try {
      await whatsappApi.disconnectInstance(instanceToAction.id);
      await loadInstances();
    } catch (err: unknown) {
      console.error("Error disconnecting:", err);
      setOperationError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao desconectar");
    }
  };

  const openDeleteDialog = (instance: WhatsAppInstance) => {
    setInstanceToAction(instance);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!instanceToAction) return;
    try {
      await whatsappApi.deleteInstance(instanceToAction.id);
      await loadInstances();
    } catch (err: unknown) {
      console.error("Error deleting:", err);
      setOperationError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao deletar instância");
    }
  };

  const handleReconnect = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setQrModalOpen(true);
  };

  const handleSyncStatus = async (instanceId: string) => {
    setSyncing((prev) => ({ ...prev, [instanceId]: true }));
    try {
      await whatsappApi.syncStatus(instanceId);
      await loadInstances();
    } catch (err: unknown) {
      console.error("Error syncing status:", err);
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao sincronizar status");
    } finally {
      setSyncing((prev) => ({ ...prev, [instanceId]: false }));
    }
  };

  const getStatusBadge = (status: WhatsAppStatus) => {
    switch (status) {
      case WhatsAppStatus.CONNECTED:
        return (
          <Badge className="bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20 shadow-none">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case WhatsAppStatus.CONNECTING:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 hover:bg-yellow-500/20 shadow-none">
            <AlertCircle className="w-3 h-3 mr-1" />
            Conectando
          </Badge>
        );
      case WhatsAppStatus.DISCONNECTED:
        return (
          <Badge className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 shadow-none">
            <XCircle className="w-3 h-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  const connectedCount = instances.filter(i => i.status === WhatsAppStatus.CONNECTED).length;

  if (loading && !instances.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          <p className="text-sm text-muted-foreground">Carregando conexões...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return <LoadingErrorState resource="configurações do WhatsApp" onRetry={loadInstances} />;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Operation Error */}
      {operationError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          <p>{operationError}</p>
          <button onClick={() => setOperationError(null)} className="ml-auto hover:opacity-70">
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Layout: Config + Tutorial Image */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Connection Config */}
        <div className="lg:col-span-3 space-y-6">
          {/* Connect Card */}
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Smartphone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Conectar WhatsApp</CardTitle>
                    <CardDescription className="text-xs">Conecte para enviar e receber mensagens</CardDescription>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{instances.length}<span className="text-muted-foreground text-sm font-normal"> / {limitDisplay}</span></p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{resolvedPlan ?? '—'}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleCreateInstance}
                  disabled={creating || instanceLimit === null || instances.length >= instanceLimit}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Adicionar WhatsApp
                </Button>
                {instanceLimit !== null && instances.length >= instanceLimit && (
                  <p className="text-xs text-muted-foreground">
                    Limite atingido. Faça upgrade para conectar mais.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Strategy Card */}
          {instances.length > 1 && (
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Estrategia de Envio</CardTitle>
                <CardDescription className="text-xs">Como o sistema escolhe qual instancia usar para novas mensagens</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  className="w-full p-2 text-sm border rounded-lg bg-background"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as "RANDOM" | "SPECIFIC")}
                >
                  <option value="RANDOM">Distribuir aleatoriamente entre as conectadas</option>
                  <option value="SPECIFIC">Sempre usar uma instancia especifica</option>
                </select>

                {strategy === "SPECIFIC" && (
                  <select
                    className="w-full p-2 text-sm border rounded-lg bg-background"
                    value={defaultInstanceId || ""}
                    onChange={(e) => setDefaultInstanceId(e.target.value)}
                  >
                    <option value="" disabled>Selecione uma instancia...</option>
                    {instances.filter(i => i.status === WhatsAppStatus.CONNECTED).map(i => (
                      <option key={i.id} value={i.id}>{i.displayName || i.instanceName} ({i.phoneNumber || 'Sem numero'})</option>
                    ))}
                  </select>
                )}

                <Button
                  onClick={async () => {
                    try {
                      setSavingStrategy(true);
                      await whatsappApi.updateStrategy(strategy, strategy === "SPECIFIC" ? defaultInstanceId : null);
                      toast.success("Estrategia salva!");
                    } catch (err: unknown) {
                      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao salvar estrategia");
                    } finally {
                      setSavingStrategy(false);
                    }
                  }}
                  disabled={savingStrategy || (strategy === "SPECIFIC" && !defaultInstanceId)}
                  size="sm"
                >
                  {savingStrategy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Instances List */}
          {instances.length > 0 ? (
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Conexoes Ativas</CardTitle>
                    <CardDescription className="text-xs">
                      {connectedCount} de {instances.length} {instances.length === 1 ? 'instancia conectada' : 'instancias conectadas'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${connectedCount > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-muted-foreground">{connectedCount > 0 ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y">
                  {instances.map((instance) => (
                    <div key={instance.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${instance.status === WhatsAppStatus.CONNECTED
                          ? 'bg-green-500/10'
                          : instance.status === WhatsAppStatus.CONNECTING
                            ? 'bg-yellow-500/10'
                            : 'bg-red-500/10'
                          }`}>
                          {instance.status === WhatsAppStatus.CONNECTED ? (
                            <Wifi className="h-4 w-4 text-green-600" />
                          ) : instance.status === WhatsAppStatus.CONNECTING ? (
                            <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{instance.displayName || instance.instanceName}</p>
                            {getStatusBadge(instance.status)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {instance.phoneNumber && <span>{instance.phoneNumber}</span>}
                            {instance.phoneNumber && instance.connectedAt && <span>·</span>}
                            {instance.connectedAt && (
                              <span>Desde {new Date(instance.connectedAt).toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          onClick={() => handleSyncStatus(instance.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={syncing[instance.id]}
                          title="Sincronizar status"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${syncing[instance.id] ? "animate-spin" : ""}`} />
                        </Button>

                        {instance.status === WhatsAppStatus.CONNECTED && (
                          <Button onClick={() => openDisconnectDialog(instance)} variant="outline" size="sm" className="h-8 text-xs">
                            Desconectar
                          </Button>
                        )}

                        {instance.status === WhatsAppStatus.DISCONNECTED && (
                          <Button onClick={() => handleReconnect(instance.id)} variant="outline" size="sm" className="h-8 text-xs">
                            Reconectar
                          </Button>
                        )}

                        {instance.status === WhatsAppStatus.CONNECTING && (
                          <Button onClick={() => handleReconnect(instance.id)} variant="outline" size="sm" className="h-8 text-xs">
                            Ver QR Code
                          </Button>
                        )}

                        <Button onClick={() => openDeleteDialog(instance)} variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-dashed border-border/60">
              <CardContent className="py-12">
                <div className="text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
                    <Smartphone className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Nenhuma conexao ativa</p>
                    <p className="text-xs text-muted-foreground">Clique em "Adicionar WhatsApp" para comecar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Tutorial Image */}
        <div className="lg:col-span-2 hidden lg:block">
          <div className="sticky top-8">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/50 dark:border-green-800/30 rounded-2xl p-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-medium text-green-700 dark:text-green-400">
                  <QrCode className="h-3 w-3" />
                  Como conectar
                </div>
                {/* <p className="text-xs text-muted-foreground">Escaneie o QR Code no WhatsApp do seu celular</p> */}
              </div>
              <div className="flex justify-center">
                <div className="relative w-full max-w-[220px]">
                  <Image
                    src={phoneTutorial}
                    alt="Tutorial de como conectar o WhatsApp escaneando o QR Code"
                    className="w-full h-auto rounded-xl"
                    priority
                  />
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] font-bold text-green-600">1</span>
                  <span>Abra o WhatsApp no celular e clique nos 3 pontinhos na parte de cima </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] font-bold text-green-600">2</span>
                  <span>Selecione a opção <strong className="text-foreground">Dispositivos conectados</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] font-bold text-green-600">3</span>
                  <span>Clique no botão <strong className="text-foreground">Conectar dispositivo</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-[10px] font-bold text-green-600">4</span>
                  <span>Escaneie o QR Code que aparecera na tela</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
