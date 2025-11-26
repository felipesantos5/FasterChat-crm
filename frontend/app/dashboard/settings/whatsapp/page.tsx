'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRCodeModal } from '@/components/whatsapp/qr-code-modal';
import { DisconnectConfirmDialog } from '@/components/whatsapp/disconnect-confirm-dialog';
import { whatsappApi } from '@/lib/whatsapp';
import { WhatsAppInstance, WhatsAppStatus } from '@/types/whatsapp';
import { Loader2, Smartphone, CheckCircle2, XCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';

export default function WhatsAppSettingsPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<{ [key: string]: boolean }>({});

  // Estados para os modais de confirmação
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceToAction, setInstanceToAction] = useState<WhatsAppInstance | null>(null);

  // Obtém o companyId do usuário logado (você pode ajustar conforme sua implementação)
  const getCompanyId = () => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega as instâncias
  const loadInstances = async () => {
    try {
      setError(null);
      const companyId = getCompanyId();
      if (!companyId) {
        setError('Empresa não encontrada');
        return;
      }

      const response = await whatsappApi.getInstances(companyId);
      setInstances(response.data);
    } catch (err: any) {
      console.error('Error loading instances:', err);
      setError(err.response?.data?.message || 'Erro ao carregar instâncias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();

    // Polling: Atualiza status a cada 10 segundos (reduzido de 5s)
    // Útil quando webhook não funciona (Evolution em Docker)
    // IMPORTANTE: Pausa quando modal está aberto para evitar conflito
    const interval = setInterval(() => {
      // Só faz polling se o modal NÃO estiver aberto
      if (!qrModalOpen) {
        console.log('[WhatsApp Settings] Polling instances status...');
        loadInstances();
      } else {
        console.log('[WhatsApp Settings] Modal aberto, pulando polling');
      }
    }, 10000); // Aumentado de 5s para 10s

    return () => clearInterval(interval);
  }, [qrModalOpen]); // Adiciona qrModalOpen como dependência

  // Cria uma nova instância
  const handleCreateInstance = async () => {
    try {
      setCreating(true);
      setError(null);

      const companyId = getCompanyId();
      if (!companyId) {
        setError('Empresa não encontrada');
        return;
      }

      const response = await whatsappApi.createInstance(companyId);
      setSelectedInstanceId(response.data.id);
      setQrModalOpen(true);

      // Recarrega a lista
      await loadInstances();
    } catch (err: any) {
      console.error('Error creating instance:', err);
      setError(err.response?.data?.message || 'Erro ao criar instância');
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
      console.error('Error disconnecting:', err);
      setError(err.response?.data?.message || 'Erro ao desconectar');
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
      console.error('Error deleting:', err);
      setError(err.response?.data?.message || 'Erro ao deletar instância');
    }
  };

  // Abre o modal de QR Code
  const handleReconnect = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setQrModalOpen(true);
  };

  // Sincroniza status manualmente com Evolution API
  const handleSyncStatus = async (instanceId: string) => {
    setSyncing(prev => ({ ...prev, [instanceId]: true }));
    try {
      await whatsappApi.syncStatus(instanceId);
      await loadInstances();
    } catch (err: any) {
      console.error('Error syncing status:', err);
      alert(err.response?.data?.message || 'Erro ao sincronizar status');
    } finally {
      setSyncing(prev => ({ ...prev, [instanceId]: false }));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground">
          Configure e gerencie suas conexões do WhatsApp
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
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
          <CardDescription>
            Conecte sua conta do WhatsApp para enviar e receber mensagens através do CRM
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleCreateInstance}
            disabled={creating || instances.some(i => i.status === WhatsAppStatus.CONNECTED)}
          >
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {instances.some(i => i.status === WhatsAppStatus.CONNECTED)
              ? 'WhatsApp Já Conectado'
              : 'Conectar WhatsApp'}
          </Button>
        </CardContent>
      </Card>

      {/* Instances List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : instances.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Conexões Ativas</CardTitle>
            <CardDescription>
              Gerencie suas instâncias conectadas do WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{instance.instanceName}</p>
                      {getStatusBadge(instance.status)}
                    </div>
                    {instance.phoneNumber && (
                      <p className="text-sm text-muted-foreground">
                        Telefone: {instance.phoneNumber}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Criado em: {new Date(instance.createdAt).toLocaleString('pt-BR')}
                    </p>
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
                      <RefreshCw className={`h-4 w-4 ${syncing[instance.id] ? 'animate-spin' : ''}`} />
                    </Button>

                    {instance.status === WhatsAppStatus.CONNECTED && (
                      <Button
                        onClick={() => openDisconnectDialog(instance)}
                        variant="outline"
                        size="sm"
                      >
                        Desconectar
                      </Button>
                    )}

                    {instance.status === WhatsAppStatus.DISCONNECTED && (
                      <Button
                        onClick={() => handleReconnect(instance.id)}
                        variant="outline"
                        size="sm"
                      >
                        Reconectar
                      </Button>
                    )}

                    {instance.status === WhatsAppStatus.CONNECTING && (
                      <Button
                        onClick={() => handleReconnect(instance.id)}
                        variant="outline"
                        size="sm"
                      >
                        Ver QR Code
                      </Button>
                    )}

                    <Button
                      onClick={() => openDeleteDialog(instance)}
                      variant="destructive"
                      size="sm"
                    >
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
              <p className="text-muted-foreground">
                Nenhuma instância conectada ainda
              </p>
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
          instanceName={instanceToAction.instanceName}
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
          instanceName={instanceToAction.instanceName}
          phoneNumber={instanceToAction.phoneNumber}
          isDeleting={true}
        />
      )}
    </div>
  );
}
