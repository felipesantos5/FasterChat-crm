"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiKnowledgeApi } from "@/lib/ai-knowledge";
import { AIKnowledge } from "@/types/ai-knowledge";
import { Loader2, Save, Check, Bot, Settings2 } from "lucide-react";

export default function AISettingsPage() {
  const [knowledge, setKnowledge] = useState<AIKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [companyInfo, setCompanyInfo] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [toneInstructions, setToneInstructions] = useState("");
  const [policies, setPolicies] = useState("");

  // Configurações avançadas
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);

  // Autosave timer
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Obtém companyId
  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Carrega conhecimento
  const loadKnowledge = async () => {
    try {
      setError(null);
      const companyId = getCompanyId();

      if (!companyId) {
        setError("Empresa não encontrada");
        return;
      }

      const response = await aiKnowledgeApi.getKnowledge(companyId);

      if (response.data) {
        setKnowledge(response.data);
        setCompanyInfo(response.data.companyInfo || "");
        setProductsServices(response.data.productsServices || "");
        setToneInstructions(response.data.toneInstructions || "");
        setPolicies(response.data.policies || "");

        // Configurações avançadas
        setProvider(response.data.provider || "openai");
        setTemperature(response.data.temperature ?? 0.7);
        setMaxTokens(response.data.maxTokens ?? 500);
        setAutoReplyEnabled(response.data.autoReplyEnabled ?? true);
      }
    } catch (err: any) {
      console.error("Error loading knowledge:", err);
      setError(err.response?.data?.message || "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  // Salva conhecimento
  const saveKnowledge = async () => {
    try {
      setSaving(true);
      setSaved(false);
      setError(null);

      const companyId = getCompanyId();

      if (!companyId) {
        setError("Empresa não encontrada");
        return;
      }

      const response = await aiKnowledgeApi.updateKnowledge({
        companyId,
        companyInfo,
        productsServices,
        toneInstructions,
        policies,
        provider,
        temperature,
        maxTokens,
        autoReplyEnabled,
      });

      setKnowledge(response.data);
      setSaved(true);

      // Remove badge "Salvo" após 3 segundos
      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err: any) {
      console.error("Error saving knowledge:", err);
      setError(err.response?.data?.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  // Autosave: salva após 3s de inatividade
  const handleFieldChange = (field: string, value: string) => {
    // Atualiza o campo
    switch (field) {
      case "companyInfo":
        setCompanyInfo(value);
        break;
      case "productsServices":
        setProductsServices(value);
        break;
      case "toneInstructions":
        setToneInstructions(value);
        break;
      case "policies":
        setPolicies(value);
        break;
    }

    // Cancela timer anterior
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    // Cria novo timer de 3s
    autosaveTimer.current = setTimeout(() => {
      saveKnowledge();
    }, 3000);
  };

  // Cleanup do timer
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Configurações da IA
          </h1>
          <p className="text-muted-foreground mt-1">Configure a base de conhecimento da IA para melhorar as respostas automáticas</p>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <Badge className="bg-green-500 hover:bg-green-600">
              <Check className="h-3 w-3 mr-1" />
              Salvo
            </Badge>
          )}
          {saving && (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Salvando...
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Base de Conhecimento</CardTitle>
          <CardDescription>
            As informações abaixo serão usadas pela IA para gerar respostas mais precisas e personalizadas. O sistema salva automaticamente após 3
            segundos de inatividade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sobre sua empresa */}
          <div className="space-y-2">
            <Label htmlFor="companyInfo">
              Sobre sua empresa
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Textarea
              id="companyInfo"
              placeholder="Descreva o que você faz, vende, história da empresa, missão e valores..."
              value={companyInfo}
              onChange={(e) => handleFieldChange("companyInfo", e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Produtos e Serviços */}
          <div className="space-y-2">
            <Label htmlFor="productsServices">
              Produtos e Serviços
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Textarea
              id="productsServices"
              placeholder="Liste produtos, preços, descrições detalhadas, categorias, variações..."
              value={productsServices}
              onChange={(e) => handleFieldChange("productsServices", e.target.value)}
              rows={8}
              className="resize-none"
            />
          </div>

          {/* Tom de Voz */}
          <div className="space-y-2">
            <Label htmlFor="toneInstructions">
              Tom de Voz e Instruções
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Textarea
              id="toneInstructions"
              placeholder="Exemplo: Seja informal e use emojis. Se apresente como 'Assistente Virtual da [Nome]'. Seja simpático e prestativo. Use linguagem jovem..."
              value={toneInstructions}
              onChange={(e) => handleFieldChange("toneInstructions", e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Políticas Importantes */}
          <div className="space-y-2">
            <Label htmlFor="policies">
              Políticas Importantes
              <span className="text-muted-foreground text-xs ml-2">(opcional)</span>
            </Label>
            <Textarea
              id="policies"
              placeholder="Prazos de entrega, políticas de garantia, formas de pagamento aceitas, horário de atendimento, política de trocas e devoluções..."
              value={policies}
              onChange={(e) => handleFieldChange("policies", e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Botão Salvar Manual */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">💡 As alterações são salvas automaticamente após 3 segundos</p>
            <Button onClick={saveKnowledge} disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Agora
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Avançadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações Avançadas
          </CardTitle>
          <CardDescription>Ajuste fino do comportamento da IA e respostas automáticas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resposta Automática Habilitada */}
          <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="autoReply" className="text-base">
                Resposta Automática
              </Label>
              <p className="text-sm text-muted-foreground">Permite que a IA responda automaticamente mensagens dos clientes</p>
            </div>
            <Switch
              id="autoReply"
              checked={autoReplyEnabled}
              onCheckedChange={(checked) => {
                setAutoReplyEnabled(checked);
                handleFieldChange("autoReplyEnabled", String(checked));
              }}
            />
          </div>

          {/* Provider da IA */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provedor de IA</Label>
            <Select
              value={provider}
              onValueChange={(value: "openai" | "anthropic") => {
                setProvider(value);
                handleFieldChange("provider", value);
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (GPT-4o Mini)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude Sonnet)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {provider === "openai"
                ? "Mais rápido e econômico, ótimo para a maioria dos casos"
                : "Mais inteligente e contextual, ideal para conversas complexas"}
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="temperature">Criatividade (Temperature): {temperature.toFixed(2)}</Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.1}
                value={[temperature]}
                onValueChange={(value) => {
                  setTemperature(value[0]);
                  handleFieldChange("temperature", String(value[0]));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Valores mais baixos (0.0-0.3) = Respostas mais conservadoras e previsíveis
                <br />
                Valores mais altos (0.7-1.0) = Respostas mais criativas e variadas
              </p>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Tamanho Máximo da Resposta: {maxTokens} tokens</Label>
              <Slider
                id="maxTokens"
                min={100}
                max={2000}
                step={100}
                value={[maxTokens]}
                onValueChange={(value) => {
                  setMaxTokens(value[0]);
                  handleFieldChange("maxTokens", String(value[0]));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Controla o tamanho máximo das respostas da IA
                <br />
                500 tokens ≈ 375 palavras ou 1-2 parágrafos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preview do Contexto da IA</CardTitle>
          <CardDescription className="text-xs">Veja como as informações serão formatadas para a IA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg text-sm space-y-2 max-h-60 overflow-y-auto">
            {companyInfo && (
              <div>
                <strong>Sobre a Empresa:</strong>
                <p className="text-muted-foreground whitespace-pre-wrap">{companyInfo}</p>
              </div>
            )}
            {productsServices && (
              <div>
                <strong>Produtos e Serviços:</strong>
                <p className="text-muted-foreground whitespace-pre-wrap">{productsServices}</p>
              </div>
            )}
            {toneInstructions && (
              <div>
                <strong>Tom de Voz:</strong>
                <p className="text-muted-foreground whitespace-pre-wrap">{toneInstructions}</p>
              </div>
            )}
            {policies && (
              <div>
                <strong>Políticas:</strong>
                <p className="text-muted-foreground whitespace-pre-wrap">{policies}</p>
              </div>
            )}
            {!companyInfo && !productsServices && !toneInstructions && !policies && (
              <p className="text-muted-foreground text-xs">Preencha os campos acima para ver o preview</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
