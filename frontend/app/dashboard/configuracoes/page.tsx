"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { authApi } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, User, Volume2, Bell, CreditCard, Zap, Sparkles } from "lucide-react";
import { spacing } from "@/lib/design-system";
import { notificationSound } from "@/lib/notification-sound";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { PricingModal } from "@/components/dashboard/pricing-modal";
import { Badge } from "@/components/ui/badge";

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

  const { currentPlanName } = usePlanFeatures();
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
      </div>

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </div>
  );
}
