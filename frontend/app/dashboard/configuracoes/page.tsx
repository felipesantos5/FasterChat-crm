"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { authApi } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, User, Building } from "lucide-react";
import { spacing } from "@/lib/design-system";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "Minha Empresa", // Idealmente viria do backend se tivermos endpoint pra isso
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        companyName: "Carregando...", // Placeholder
      });
      // Aqui você poderia fazer um fetch específico da empresa se necessário
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updatedUser = await authApi.updateProfile({
        name: formData.name,
        email: formData.email,
        // companyName: formData.companyName // Enviar se o backend suportar
      });

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
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <User className="h-5 w-5 text-purple-600" />
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
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            {/* Dados da Empresa */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Empresa</CardTitle>
                    <CardDescription>Dados visíveis nos relatórios</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da Empresa</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Nome da sua empresa"
                  />
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p>
                    O plano atual permite até <strong>5 conexões</strong> de WhatsApp e usuários ilimitados.
                  </p>
                </div>
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
    </div>
  );
}
