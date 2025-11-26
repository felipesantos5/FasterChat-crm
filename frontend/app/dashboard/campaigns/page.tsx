'use client';

import { useEffect, useState } from 'react';
import { campaignApi } from '@/lib/campaign';
import { Campaign, CampaignStatus, CampaignType } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Send, Edit, Trash, XCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);

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

  const handleSendNow = async (campaignId: string, isRepeat = false) => {
    const message = isRepeat
      ? 'Deseja disparar esta campanha novamente? As mensagens serão enviadas para todos os clientes com as tags selecionadas.'
      : 'Deseja disparar esta campanha agora? As mensagens serão enviadas imediatamente.';

    if (!confirm(message)) {
      return;
    }

    try {
      setSendingCampaignId(campaignId);
      await campaignApi.sendNow(campaignId);
      alert('Campanha iniciada! As mensagens estão sendo enviadas em segundo plano.');
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      alert(error.response?.data?.message || 'Erro ao disparar campanha');
    } finally {
      setSendingCampaignId(null);
    }
  };

  const handleDelete = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) {
      return;
    }

    try {
      await campaignApi.delete(campaignId);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      alert(error.response?.data?.message || 'Erro ao excluir campanha');
    }
  };

  const handleCancel = async (campaignId: string) => {
    if (!confirm('Deseja cancelar esta campanha?')) {
      return;
    }

    try {
      await campaignApi.cancel(campaignId);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error canceling campaign:', error);
      alert(error.response?.data?.message || 'Erro ao cancelar campanha');
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground">
            Gerencie suas campanhas de disparo em massa
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/campaigns/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground">
              Nenhuma campanha criada ainda.
            </p>
            <Button
              onClick={() => router.push('/dashboard/campaigns/new')}
              className="mt-4"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira campanha
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-6">
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
                        onClick={() => router.push(`/dashboard/campaigns/${campaign.id}/edit`)}
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        onClick={() => handleSendNow(campaign.id, campaign.sentCount > 0)}
                        size="sm"
                        disabled={sendingCampaignId === campaign.id}
                      >
                        {sendingCampaignId === campaign.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        {campaign.sentCount > 0 ? 'Disparar Novamente' : 'Disparar'}
                      </Button>
                    </>
                  )}

                  {campaign.status === CampaignStatus.PENDING && (
                    <>
                      <Button
                        onClick={() => handleSendNow(campaign.id)}
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
                      <Button
                        onClick={() => handleCancel(campaign.id)}
                        variant="outline"
                        size="sm"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  )}

                  {campaign.status === CampaignStatus.PROCESSING && (
                    <Badge variant="default">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Enviando...
                    </Badge>
                  )}

                  {(campaign.status === CampaignStatus.COMPLETED ||
                    campaign.status === CampaignStatus.FAILED ||
                    campaign.status === CampaignStatus.CANCELED) && (
                    <Button
                      onClick={() => handleDelete(campaign.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
