"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus, AlertCircle } from "lucide-react";
import { customerApi } from "@/lib/customer";
import { conversationApi } from "@/lib/conversation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  profilePicUrl?: string | null;
}

interface NewConversationDialogProps {
  trigger?: React.ReactNode;
  onConversationCreated?: (customer: CustomerData) => void;
}

export function NewConversationDialog({
  trigger,
  onConversationCreated,
}: NewConversationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const formatPhoneNumber = (phone: string) => {
    // Remove tudo que não for número
    let cleaned = phone.replace(/\D/g, "");

    // Se já tem o código do país (55), mantém
    // Se não tem, adiciona
    if (!cleaned.startsWith("55") && cleaned.length >= 10) {
      cleaned = "55" + cleaned;
    }

    // NÃO adiciona @s.whatsapp.net - esse é o formato do remoteJid, não o formato do banco
    return cleaned;
  };

  const validatePhone = (phone: string) => {
    // Remove formatação
    const cleaned = phone.replace(/\D/g, "");

    // Verifica se tem pelo menos 10 dígitos (DDD + número)
    if (cleaned.length < 10) {
      return "Número de telefone inválido. Mínimo 10 dígitos (DDD + número)";
    }

    // Verifica se não é muito longo
    if (cleaned.length > 15) {
      return "Número de telefone muito longo";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (!formData.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!formData.phone.trim()) {
      setError("Telefone é obrigatório");
      return;
    }

    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    try {
      setLoading(true);

      // Obtém o companyId do usuário logado
      const user = localStorage.getItem("user");
      if (!user) {
        setError("Usuário não autenticado");
        return;
      }
      const userData = JSON.parse(user);
      const companyId = userData.companyId;

      // Formata o número de telefone
      const formattedPhone = formatPhoneNumber(formData.phone);
      // Versão apenas com números para busca (sem prefixo 55 se não tiver)
      const searchPhone = formData.phone.replace(/\D/g, "");

      // Verifica se o cliente já existe
      let customer;
      try {
        const existingCustomers = await customerApi.getAll({ search: searchPhone });
        // Procura por correspondência parcial no telefone (últimos dígitos)
        customer = existingCustomers.customers.find((c) => {
          const customerDigits = c.phone.replace(/\D/g, "");
          return customerDigits === formattedPhone ||
                 customerDigits.endsWith(searchPhone) ||
                 formattedPhone.endsWith(customerDigits);
        });
      } catch (err) {
        console.log("Cliente não encontrado, criando novo...");
      }

      // Se não existe, cria o cliente
      if (!customer) {
        customer = await customerApi.create({
          name: formData.name.trim(),
          phone: formattedPhone,
        });
        console.log("Cliente criado:", customer);
      }

      // Cria ou obtém a conversa para esse cliente
      console.log("Iniciando conversa para cliente:", customer.id);
      await conversationApi.getConversation(customer.id, companyId);
      console.log("Conversa iniciada com sucesso!");

      // Mostra toast de sucesso
      toast.success("Conversa criada!", {
        description: `Você pode enviar mensagens para ${formData.name.trim()}`,
      });

      // Reseta o formulário
      setFormData({ name: "", phone: "" });
      setOpen(false);

      // Callback ou navega para a conversa
      if (onConversationCreated) {
        // Chama o callback passando os dados do cliente
        onConversationCreated({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          profilePicUrl: customer.profilePicUrl,
        });
      } else {
        // Se não tem callback, navega diretamente
        router.push(`/dashboard/conversations?customer=${customer.id}`);
      }
    } catch (err: any) {
      console.error("Error creating conversation:", err);
      setError(
        err.response?.data?.message || "Erro ao criar conversa. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Permite apenas números, espaços, parênteses, hífen e +
    const cleaned = value.replace(/[^\d\s()\-+]/g, "");
    setFormData({ ...formData, phone: cleaned });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            Nova Conversa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>
              Inicie uma nova conversa com um cliente. Se o número já estiver
              cadastrado, a conversa será aberta.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nome do Cliente */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Nome do Cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={loading}
                required
              />
            </div>

            {/* Telefone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ex: (11) 99999-9999 ou 11999999999"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Digite apenas números com DDD (ex: 11999999999). O código do país será adicionado automaticamente.
              </p>
            </div>

            {/* Erro */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={loading}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              {loading ? "Criando..." : "Iniciar Conversa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
