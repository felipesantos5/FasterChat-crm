"use client";

import { useAuthStore } from "@/lib/store/auth.store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PerfilPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Seus dados cadastrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nome</p>
              <p className="text-base">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Função</p>
              <p className="text-base">{user?.role}</p>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Configurações de segurança</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">Funcionalidade de alteração de senha em desenvolvimento</p>
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
