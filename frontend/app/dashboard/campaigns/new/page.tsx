"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { campaignApi } from "@/lib/campaign";
import { customerApi } from "@/lib/customer";
import { CampaignType } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagSelector } from "@/components/forms/tag-selector";
import { ArrowLeft, Loader2, Users, CalendarClock, Info } from "lucide-react";
import { Tag } from "@/lib/tag";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { toast } from "sonner";

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [estimate, setEstimate] = useState<{ totalCustomers: number; estimatedDuration: number } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    messageTemplate: "",
    targetTags: [] as string[],
    type: CampaignType.MANUAL,
    scheduledAt: undefined as Date | undefined,
  });

  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  const loadTags = async () => {
    try {
      const tags = await customerApi.getAllTags();
      setAvailableTags(tags);
      console.log("[CampaignForm] Tags loaded:", tags);
    } catch (error) {
      console.error("[CampaignForm] Error loading tags:", error);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // Atualiza estimativa quando as tags mudam
  useEffect(() => {
    if (formData.targetTags.length > 0) {
      loadEstimate();
    } else {
      setEstimate(null);
    }
  }, [formData.targetTags]);

  const loadEstimate = async () => {
    try {
      setLoadingEstimate(true);
      const companyId = getCompanyId();
      if (!companyId) return;

      const result = await campaignApi.estimateReach(companyId, formData.targetTags);
      setEstimate(result);
    } catch (error) {
      console.error("Error loading estimate:", error);
    } finally {
      setLoadingEstimate(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} segundos`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds}s` : `${minutes} minutos`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.messageTemplate || formData.targetTags.length === 0) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    if (formData.type === CampaignType.SCHEDULED && !formData.scheduledAt) {
      toast.error("Por favor, defina a data e hora do agendamento");
      return;
    }

    // Validação: agendamento deve ser no futuro
    if (formData.type === CampaignType.SCHEDULED && formData.scheduledAt) {
      const now = new Date();
      if (formData.scheduledAt <= now) {
        toast.error("A data de agendamento deve ser no futuro");
        return;
      }
    }

    try {
      setLoading(true);
      const companyId = getCompanyId();
      if (!companyId) {
        toast.error("Empresa não encontrada");
        return;
      }

      // Converte a data para ISO string no fuso horário do Brasil
      let scheduledAtISO: string | undefined;
      if (formData.scheduledAt) {
        // Envia a data como ISO string - o backend vai processar no fuso de Brasília
        scheduledAtISO = formData.scheduledAt.toISOString();
      }

      await campaignApi.create({
        companyId,
        name: formData.name,
        messageTemplate: formData.messageTemplate,
        targetTags: formData.targetTags,
        type: formData.type,
        scheduledAt: scheduledAtISO,
      });

      if (formData.type === CampaignType.SCHEDULED) {
        toast.success("🗓️ Campanha criada e agendada com sucesso!");
      } else {
        toast.success("Campanha criada com sucesso!");
      }

      router.push("/dashboard/campaigns");
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast.error(error.response?.data?.message || "Erro ao criar campanha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-8">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Nova Campanha</h1>
        <p className="text-muted-foreground">Configure e crie uma nova campanha de disparo em massa</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Defina o nome e a mensagem da campanha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Campanha *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Promoção Black Friday 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem *</Label>
              <Textarea
                id="message"
                value={formData.messageTemplate}
                onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                placeholder="Digite a mensagem que será enviada para os clientes..."
                rows={6}
                required
              />
              <p className="text-xs text-muted-foreground">Caracteres: {formData.messageTemplate.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Público Alvo */}
        <Card>
          <CardHeader>
            <CardTitle>Público Alvo</CardTitle>
            <CardDescription>Selecione as tags dos clientes que receberão a campanha</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tags Alvo *</Label>
              <TagSelector
                value={formData.targetTags}
                onChange={(tags) => setFormData({ ...formData, targetTags: tags })}
                availableTags={availableTags}
                placeholder="Selecionar tags para segmentar clientes..."
                onTagCreated={async (tag) => {
                  console.log("[CampaignForm] Nova tag criada:", tag.name);
                  // Recarrega as tags disponíveis
                  await loadTags();
                }}
              />
              <p className="text-xs text-muted-foreground">Clientes que possuírem pelo menos uma dessas tags receberão a mensagem</p>
            </div>

            {/* Estimativa */}
            {loadingEstimate ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando alcance...
              </div>
            ) : estimate ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Estimativa de Alcance</h3>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Total de clientes:</span>{" "}
                    <span className="font-semibold text-lg">{estimate.totalCustomers}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tempo estimado:</span>{" "}
                    <span className="font-medium">{formatDuration(estimate.estimatedDuration)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Considerando um intervalo de 2-5 segundos entre cada envio para evitar bloqueios
                  </p>
                </div>
              </div>
            ) : formData.targetTags.length > 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum cliente encontrado com essas tags</div>
            ) : null}
          </CardContent>
        </Card>

        {/* Agendamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Tipo de Envio
            </CardTitle>
            <CardDescription>Escolha entre envio imediato ou agendado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    type: value as CampaignType,
                    // Limpa a data ao mudar para manual
                    scheduledAt: value === CampaignType.MANUAL ? undefined : formData.scheduledAt
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CampaignType.MANUAL}>Envio Manual (Disparar quando quiser)</SelectItem>
                  <SelectItem value={CampaignType.SCHEDULED}>Envio Agendado (Data e hora específica)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === CampaignType.SCHEDULED && (
              <div className="space-y-3">
                <Label>Data e Hora do Envio *</Label>
                <DateTimePicker
                  value={formData.scheduledAt}
                  onChange={(date) => setFormData({ ...formData, scheduledAt: date })}
                  placeholder="Selecione quando disparar a campanha"
                  minDate={new Date()}
                />

                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium">Disparo Automático</p>
                      <p className="text-xs mt-1">
                        A campanha será disparada automaticamente na data e hora selecionadas.
                        O sistema usa o fuso horário de Brasília (GMT-3).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {formData.type === CampaignType.MANUAL && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Envio Manual</p>
                  <p className="text-xs mt-1">
                    Após criar a campanha, você poderá disparar manualmente quando quiser
                    clicando no botão "Disparar Agora" na lista de campanhas.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Campanha
          </Button>
        </div>
      </form>
    </div>
  );
}
