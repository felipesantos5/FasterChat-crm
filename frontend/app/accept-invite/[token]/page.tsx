"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collaboratorApi } from "@/lib/collaborator";
import { setAuthToken, setUser } from "@/lib/auth";
import { toast } from "sonner";

const acceptInviteSchema = z.object({
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type AcceptInviteForm = z.infer<typeof acceptInviteSchema>;

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function AcceptInvitePage(props: PageProps) {
  const params = use(props.params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteForm>({
    resolver: zodResolver(acceptInviteSchema),
  });

  const onSubmit = async (data: AcceptInviteForm) => {
    setIsSubmitting(true);
    try {
      const result = await collaboratorApi.acceptInvite(params.token, data.password);
      setAuthToken(result.token);
      setUser(result.user);
      toast.success("Bem-vindo! Convite aceito com sucesso");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao aceitar convite");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar Convite</CardTitle>
          <CardDescription>
            Crie sua senha para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Criando conta..." : "Aceitar Convite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
