"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { conversationExampleApi } from "@/lib/conversation-example";
import {
  ConversationExampleWithMessages,
  SyntheticExampleMessage,
} from "@/types/conversation-example";
import {
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  User,
  Bot,
  ArrowLeft,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ConversationExamplesPage() {
  const [examples, setExamples] = useState<ConversationExampleWithMessages[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [messages, setMessages] = useState<SyntheticExampleMessage[]>([
    { role: "customer", content: "" },
    { role: "assistant", content: "" },
  ]);

  useEffect(() => {
    loadExamples();
  }, []);

  async function loadExamples() {
    try {
      setLoading(true);
      const response = await conversationExampleApi.getExamples();
      if (response.success) {
        setExamples(response.data);
      }
    } catch (error) {
      toast.error("Erro ao carregar exemplos");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExample() {
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }

    const validMessages = messages.filter((m) => m.content.trim() !== "");
    if (validMessages.length < 2) {
      toast.error("Adicione pelo menos 2 mensagens");
      return;
    }

    try {
      setSaving(true);
      const response = await conversationExampleApi.createSynthetic({
        customerName: customerName.trim(),
        messages: validMessages,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        toast.success("Exemplo criado com sucesso!");
        setCustomerName("");
        setNotes("");
        setMessages([
          { role: "customer", content: "" },
          { role: "assistant", content: "" },
        ]);
        loadExamples();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao criar exemplo");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExample(exampleId: string) {
    try {
      setDeleting(exampleId);
      const response = await conversationExampleApi.deleteExample(exampleId);
      if (response.success) {
        toast.success("Exemplo removido");
        setExamples((prev) => prev.filter((e) => e.id !== exampleId));
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao deletar exemplo");
    } finally {
      setDeleting(null);
    }
  }

  function addMessage() {
    const lastRole = messages[messages.length - 1]?.role;
    setMessages([
      ...messages,
      { role: lastRole === "customer" ? "assistant" : "customer", content: "" },
    ]);
  }

  function removeMessage(index: number) {
    if (messages.length <= 2) return;
    setMessages(messages.filter((_, i) => i !== index));
  }

  function updateMessage(index: number, field: keyof SyntheticExampleMessage, value: string) {
    const updated = [...messages];
    updated[index] = { ...updated[index], [field]: value };
    setMessages(updated);
  }

  function toggleRole(index: number) {
    const updated = [...messages];
    updated[index] = {
      ...updated[index],
      role: updated[index].role === "customer" ? "assistant" : "customer",
    };
    setMessages(updated);
  }

  function isSynthetic(example: ConversationExampleWithMessages): boolean {
    return example.conversation.customer.tags?.includes("exemplo-sintetico") ?? false;
  }

  return (
    <div className="p-6 mx-auto space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings/ai">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Exemplos de Conversa</h1>
          <p className="text-muted-foreground">
            Crie conversas exemplo para ensinar a IA o tom e estilo ideal
          </p>
        </div>
      </div>

      {/* Lista de Exemplos Existentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Exemplos Existentes
            <Badge variant="secondary" className="ml-auto">
              {examples.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Exemplos que a IA usa como referência de estilo e abordagem
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : examples.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum exemplo cadastrado. Crie um abaixo!
            </p>
          ) : (
            <div className="space-y-4">
              {examples.map((example) => (
                <div
                  key={example.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {example.conversation.customer.name}
                      </span>
                      {isSynthetic(example) ? (
                        <Badge variant="outline">Sintético</Badge>
                      ) : (
                        <Badge variant="secondary">Conversa Real</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExample(example.id)}
                      disabled={deleting === example.id}
                    >
                      {deleting === example.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>

                  {example.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      {example.notes}
                    </p>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {example.conversation.messages.slice(0, 6).map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 text-sm ${
                          msg.direction === "INBOUND" ? "" : "justify-end"
                        }`}
                      >
                        <div
                          className={`rounded-lg px-3 py-1.5 max-w-[80%] ${
                            msg.direction === "INBOUND"
                              ? "bg-muted"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {example.conversation.messages.length > 6 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{example.conversation.messages.length - 6} mensagens...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Criar Novo Exemplo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Criar Novo Exemplo
          </CardTitle>
          <CardDescription>
            Monte uma conversa ideal entre cliente e assistente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do cliente fictício</Label>
              <Input
                placeholder="Ex: Maria Silva"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas / Cenário (opcional)</Label>
              <Input
                placeholder="Ex: Cliente perguntando sobre preços"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Mensagens da conversa</Label>
            {messages.map((msg, index) => (
              <div key={index} className="flex gap-2 items-start">
                <Button
                  type="button"
                  variant={msg.role === "customer" ? "outline" : "default"}
                  size="sm"
                  className="shrink-0 w-28"
                  onClick={() => toggleRole(index)}
                >
                  {msg.role === "customer" ? (
                    <>
                      <User className="h-3 w-3 mr-1" /> Cliente
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3 mr-1" /> Assistente
                    </>
                  )}
                </Button>
                <Textarea
                  placeholder={
                    msg.role === "customer"
                      ? "Mensagem do cliente..."
                      : "Resposta ideal do assistente..."
                  }
                  value={msg.content}
                  onChange={(e) => updateMessage(index, "content", e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                {messages.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMessage(index)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMessage}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar mensagem
            </Button>
          </div>

          <Button
            onClick={handleCreateExample}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            Salvar Exemplo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
