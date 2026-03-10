"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { authApi } from "@/lib/auth";
import { collaboratorApi, Collaborator, PendingInvite } from "@/lib/collaborator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, User, Volume2, Bell, CreditCard, Zap, Sparkles, Plus, Trash, Edit, Clock, X, Users } from "lucide-react";
import { spacing } from "@/lib/design-system";
import { notificationSound } from "@/lib/notification-sound";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { PricingModal } from "@/components/dashboard/pricing-modal";
import { CancelSubscriptionModal } from "@/components/dashboard/cancel-subscription-modal";
import { Badge } from "@/components/ui/badge";
import { InviteCollaboratorModal } from "@/components/collaborators/invite-modal";
import { EditPermissionsModal } from "@/components/collaborators/edit-permissions-modal";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
  });

  // Estados para notificações sonoras
  const [newMessageSoundEnabled, setNewMessageSoundEnabled] = useState(true);
  const [transbordoSoundEnabled, setTransbordoSoundEnabled] = useState(true);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Estados para colaboradores
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);

  const { currentPlanName, isSubscriptionActive, currentPlan } = usePlanFeatures();
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        companyName: user.companyName || "",
      });
    }

    // Carrega configurações de som
    setNewMessageSoundEnabled(notificationSound.getNewMessageSoundEnabled());
    setTransbordoSoundEnabled(notificationSound.getTransbordoSoundEnabled());
  }, [user]);

  const loadCollaborators = async () => {
    try {
      setCollaboratorsLoading(true);
      const data = await collaboratorApi.list();
      setCollaborators(data.users);
      setPendingInvites(data.pendingInvites);
    } catch (error: any) {
      console.error("Erro ao carregar colaboradores:", error);
    } finally {
      setCollaboratorsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadCollaborators();
    }
  }, [isAdmin]);

  const handleInvite = async (data: any) => {
    try {
      await collaboratorApi.invite(data);
      toast.success("Convite enviado com sucesso!");
      setInviteModalOpen(false);
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao enviar convite");
      throw error;
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador?")) return;
    try {
      await collaboratorApi.remove(id);
      toast.success("Colaborador removido com sucesso");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao remover colaborador");
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este convite?")) return;
    try {
      await collaboratorApi.cancelInvite(id);
      toast.success("Convite cancelado com sucesso");
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao cancelar convite");
    }
  };

  const handleUpdatePermissions = async (id: string, permissions: any[]) => {
    try {
      await collaboratorApi.updatePermissions(id, permissions);
      toast.success("Permissões atualizadas com sucesso");
      setEditingCollaborator(null);
      loadCollaborators();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar permissões");
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: { name: string; companyName?: string } = {
        name: formData.name,
      };

      if (isAdmin) {
        updateData.companyName = formData.companyName;
      }

      const updatedUser = await authApi.updateProfile(updateData);

      // Atualiza o store global
      useAuthStore.getState().user = { ...user!, ...updatedUser };

      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className={spacing.section}>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Perfil do Usuário */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <User className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Seu Perfil</CardTitle>
                    <CardDescription>Informações da sua conta de acesso</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <p className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-md">{user?.email}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da Empresa</Label>
                  {isAdmin ? (
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Nome da sua empresa"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground py-2 px-3 bg-muted rounded-md">
                      {user?.companyName || "Não definido"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Gerenciamento de Plano */}
            <Card className="border-green-100 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle>Seu Plano</CardTitle>
                      <CardDescription>Gerencie sua assinatura</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold px-3 py-1">
                    {user?.subscriptionStatus === "active" ? "Ativo" : "Pendente"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-green-50/50 rounded-2xl border border-green-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <Zap className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-green-700 font-bold uppercase tracking-wider">Plano Atual</p>
                      <h3 className="text-lg font-extrabold text-gray-900">{currentPlanName}</h3>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    onClick={() => setIsPricingModalOpen(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Alterar meu Plano
                  </Button>
                  <p className="text-center text-[11px] text-gray-400">
                    O upgrade é liberado instantaneamente após o pagamento.
                  </p>
                  {isSubscriptionActive && currentPlan !== "FREE" && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCancelModalOpen(true)}
                        className="text-[11px] text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors"
                      >
                        Cancelar assinatura
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configurações de Notificações Sonoras */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Volume2 className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Notificações Sonoras</CardTitle>
                    <CardDescription>
                      Controle os sons de alerta do sistema
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Som de Nova Mensagem */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="new-message-sound" className="text-base font-medium cursor-pointer">
                        Som de Nova Mensagem
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Toca quando você recebe uma nova mensagem de cliente
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => notificationSound.testNewMessageSound()}
                    >
                      Testar
                    </Button>
                    <Switch
                      id="new-message-sound"
                      checked={newMessageSoundEnabled}
                      onCheckedChange={(checked) => {
                        setNewMessageSoundEnabled(checked);
                        notificationSound.setNewMessageSoundEnabled(checked);
                        toast.success(
                          checked
                            ? "Som de nova mensagem ativado"
                            : "Som de nova mensagem desativado"
                        );
                      }}
                    />
                  </div>
                </div>

                {/* Som de Transbordo */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-orange-600" />
                      <Label htmlFor="transbordo-sound" className="text-base font-medium cursor-pointer">
                        Som de Transbordo
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Alerta quando um cliente precisa de atendimento humano
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => notificationSound.testTransbordoSound()}
                    >
                      Testar
                    </Button>
                    <Switch
                      id="transbordo-sound"
                      checked={transbordoSoundEnabled}
                      onCheckedChange={(checked) => {
                        setTransbordoSoundEnabled(checked);
                        notificationSound.setTransbordoSoundEnabled(checked);
                        toast.success(
                          checked
                            ? "Som de transbordo ativado"
                            : "Som de transbordo desativado"
                        );
                      }}
                    />
                  </div>
                </div>

                {/* <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <span className="text-lg">💡</span>
                    <span>
                      <strong>Dica:</strong> Use os botões "Testar" para ouvir como cada som será reproduzido.
                      As configurações são salvas automaticamente.
                    </span>
                  </p>
                </div> */}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Seção de Colaboradores — apenas admins */}
        {isAdmin && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Colaboradores</CardTitle>
                      <CardDescription>Gerencie colaboradores e suas permissões</CardDescription>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Convidar Colaborador
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {collaboratorsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {pendingInvites.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Convites Pendentes</h3>
                        <div className="space-y-3">
                          {pendingInvites.map((invite) => (
                            <div key={invite.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-yellow-100 rounded-lg">
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                </div>
                                <div>
                                  <p className="font-medium">{invite.name}</p>
                                  <p className="text-sm text-muted-foreground">{invite.email}</p>
                                  {invite.cargo && <p className="text-xs text-muted-foreground">{invite.cargo}</p>}
                                  <p className="text-xs text-muted-foreground mt-1">Convidado por {invite.invitedBy.name}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => handleCancelInvite(invite.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Colaboradores Ativos</h3>
                      <div className="space-y-3">
                        {collaborators.map((collaborator) => (
                          <div key={collaborator.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <User className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{collaborator.name}</p>
                                  <Badge variant={collaborator.role === "ADMIN" ? "default" : "secondary"} className="text-xs">
                                    {collaborator.role}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{collaborator.email}</p>
                                {collaborator.cargo && <p className="text-xs text-muted-foreground">{collaborator.cargo}</p>}
                                {collaborator.permissions.length === 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">Acesso total (Admin)</p>
                                )}
                              </div>
                            </div>
                            {collaborator.role !== "ADMIN" && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setEditingCollaborator(collaborator)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemove(collaborator.id)}>
                                  <Trash className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <InviteCollaboratorModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSubmit={handleInvite}
      />
      {editingCollaborator && (
        <EditPermissionsModal
          open={!!editingCollaborator}
          collaborator={editingCollaborator}
          onClose={() => setEditingCollaborator(null)}
          onSubmit={(permissions) => handleUpdatePermissions(editingCollaborator.id, permissions)}
        />
      )}

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
}
