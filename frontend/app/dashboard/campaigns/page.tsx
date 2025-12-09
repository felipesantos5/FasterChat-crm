'use client';

import { useEffect, useState } from 'react';
import { campaignApi } from '@/lib/campaign';
import { Campaign, CampaignStatus, CampaignType } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Send, Edit, Trash, XCircle, Loader2, Calendar, BarChart3, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buttons, cards, typography, spacing, icons } from "@/lib/design-system";
import { toast } from "sonner";
import { EditCampaignDialog } from '@/components/campaigns/edit-campaign-dialog';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const getCompanyId = () => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const companyId = getCompanyId();
      if (!companyId) {
        console.error('Company ID not found');
        return;
      }

      const response = await campaignApi.getAll(companyId);
      setCampaigns(response.campaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleExecute = async (campaignId: string) => {
    setSendingCampaignId(campaignId);

    toast.promise(
      campaignApi.execute(campaignId),
      {
        loading: 'Disparando campanha...',
        success: () => {
          loadCampaigns();
          return '🚀 Campanha em execução! As mensagens estão sendo enviadas em fila com delays inteligentes.';
        },
        error: (error: any) => {
          console.error('Error executing campaign:', error);
          return error.response?.data?.message || 'Erro ao disparar campanha';
        },
      }
    ).finally(() => {
      setSendingCampaignId(null);
    });
  };

  const handleSchedule = async (campaignId: string) => {
    const dateStr = prompt('Digite a data e hora para agendar (formato: YYYY-MM-DD HH:mm):\nExemplo: 2025-12-25 10:00');

    if (!dateStr) return;

    try {
      const scheduledDate = new Date(dateStr);
      if (isNaN(scheduledDate.getTime())) {
        toast.error('Data inválida! Use o formato: YYYY-MM-DD HH:mm');
        return;
      }

      if (scheduledDate <= new Date()) {
        toast.error('A data deve ser no futuro!');
        return;
      }

      await campaignApi.schedule(campaignId, scheduledDate.toISOString());
      toast.success(`📅 Campanha agendada para ${format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error scheduling campaign:', error);
      toast.error(error.response?.data?.message || 'Erro ao agendar campanha');
    }
  };

  const handleViewStats = (campaignId: string) => {
    router.push(`/dashboard/campaigns/${campaignId}/stats`);
  };

  const handleDelete = async (campaignId: string) => {
    toast.promise(
      campaignApi.delete(campaignId),
      {
        loading: 'Excluindo campanha...',
        success: () => {
          loadCampaigns();
          return 'Campanha excluída com sucesso!';
        },
        error: (error: any) => {
          console.error('Error deleting campaign:', error);
          return error.response?.data?.message || 'Erro ao excluir campanha';
        },
      }
    );
  };

  const handleCancelExecution = async (campaignId: string) => {
    toast.promise(
      campaignApi.cancelExecution(campaignId),
      {
        loading: 'Cancelando execução...',
        success: () => {
          loadCampaigns();
          return 'Execução cancelada! Mensagens já enviadas não foram afetadas.';
        },
        error: (error: any) => {
          console.error('Error canceling campaign:', error);
          return error.response?.data?.message || 'Erro ao cancelar campanha';
        },
      }
    );
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    loadCampaigns();
  };

  const getStatusBadge = (status: CampaignStatus) => {
    const variants: Record<CampaignStatus, { variant: any; label: string }> = {
      [CampaignStatus.DRAFT]: { variant: 'secondary', label: 'Rascunho' },
      [CampaignStatus.PENDING]: { variant: 'default', label: 'Pendente' },
      [CampaignStatus.PROCESSING]: { variant: 'default', label: 'Processando' },
      [CampaignStatus.COMPLETED]: { variant: 'default', label: 'Concluída' },
      [CampaignStatus.FAILED]: { variant: 'destructive', label: 'Falhou' },
      [CampaignStatus.CANCELED]: { variant: 'secondary', label: 'Cancelada' },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className={status === CampaignStatus.COMPLETED ? 'bg-green-500 hover:bg-green-600' : ''}>
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: CampaignType) => {
    return type === CampaignType.MANUAL ? (
      <Badge variant="outline">Manual</Badge>
    ) : (
      <Badge variant="outline">Agendada</Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-6">
      <div className={spacing.section}>
        {/* Header */}
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={() => router.push('/dashboard/campaigns/new')}
            className={buttons.primary}
          >
            <Plus className={`${icons.default} inline-block mr-2`} />
            Nova Campanha
          </button>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className={`${cards.default} text-center py-16`}>
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto" />
            <p className={`${typography.body} mt-4 text-gray-600`}>Carregando campanhas...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className={`${cards.default} text-center py-16`}>
            <Megaphone className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className={`${typography.sectionTitle} mb-2`}>Nenhuma campanha criada ainda</h3>
            <p className={`${typography.body} text-gray-600 mb-8`}>
              Crie sua primeira campanha de disparo em massa
            </p>
            <button
              onClick={() => router.push('/dashboard/campaigns/new')}
              className={buttons.primary}
            >
              <Plus className={`${icons.default} inline-block mr-2`} />
              Criar Primeira Campanha
            </button>
          </div>
        ) : (
          <div className={`${spacing.element} space-y-6`}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} className={cards.hover}>
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {campaign.messageTemplate.substring(0, 100)}
                      {campaign.messageTemplate.length > 100 ? '...' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Tipo:</span>
                      {getTypeBadge(campaign.type)}
                    </div>
                    {campaign.type === CampaignType.SCHEDULED && campaign.scheduledAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Agendado para:</span>
                        <span>{formatDate(campaign.scheduledAt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Tags alvo:</span>
                      <div className="flex gap-1 flex-wrap">
                        {campaign.targetTags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(campaign.sentCount > 0 || campaign.failedCount > 0) && (
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Enviadas:</span>
                        <span className="font-medium text-green-600">{campaign.sentCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Falharam:</span>
                        <span className="font-medium text-destructive">{campaign.failedCount}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Criada {formatDate(campaign.createdAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {campaign.status === CampaignStatus.DRAFT && (
                    <>
                      <Button
                        onClick={() => handleEdit(campaign)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleSchedule(campaign.id)}
                        variant="outline"
                        size="sm"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Agendar
                      </Button>
                      <Button
                        onClick={() => handleExecute(campaign.id)}
                        size="sm"
                        disabled={sendingCampaignId === campaign.id}
                      >
                        {sendingCampaignId === campaign.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Disparar Agora
                      </Button>
                    </>
                  )}

                  {campaign.status === CampaignStatus.PENDING && (
                    <>
                      <Button
                        onClick={() => handleExecute(campaign.id)}
                        size="sm"
                        disabled={sendingCampaignId === campaign.id}
                      >
                        {sendingCampaignId === campaign.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Executar Agora
                      </Button>
                      <Button
                        onClick={() => handleCancelExecution(campaign.id)}
                        variant="outline"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}

                  {campaign.status === CampaignStatus.PROCESSING && (
                    <>
                      <Button
                        onClick={() => handleViewStats(campaign.id)}
                        variant="outline"
                        size="sm"
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Ver Progresso
                      </Button>
                      <Button
                        onClick={() => handleCancelExecution(campaign.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Parar
                      </Button>
                    </>
                  )}

                  {(campaign.status === CampaignStatus.COMPLETED ||
                    campaign.status === CampaignStatus.FAILED ||
                    campaign.status === CampaignStatus.CANCELED) && (
                    <>
                      <Button
                        onClick={() => handleViewStats(campaign.id)}
                        variant="outline"
                        size="sm"
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Estatísticas
                      </Button>
                      <Button
                        onClick={() => handleDelete(campaign.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </>
                  )}
                </div>
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Campaign Dialog */}
      <EditCampaignDialog
        campaign={editingCampaign}
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingCampaign(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
