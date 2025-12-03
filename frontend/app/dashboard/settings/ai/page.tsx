"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpandableTextarea } from "@/components/ui/expandable-textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aiKnowledgeApi } from "@/lib/ai-knowledge";
import { AIKnowledge } from "@/types/ai-knowledge";
import { Loader2, Save, Check, Bot, Settings2 } from "lucide-react";
import { typography, spacing } from "@/lib/design-system";

export default function AISettingsPage() {
  const [, setKnowledge] = useState<AIKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [companyInfo, setCompanyInfo] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [toneInstructions, setToneInstructions] = useState("");
  const [policies, setPolicies] = useState("");
  const [negativeExamples, setNegativeExamples] = useState("");

  // Configurações avançadas
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [model, setModel] = useState<string>("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [savingAdvanced, setSavingAdvanced] = useState(false);

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
        setNegativeExamples(response.data.negativeExamples || "");

        // Configurações avançadas
        const loadedProvider = (response.data.provider as "openai" | "anthropic") || "openai";
        setProvider(loadedProvider);

        // Define modelo padrão se não houver modelo salvo
        const loadedModel = response.data.model || (loadedProvider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-5-20250929");
        setModel(loadedModel);

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
        negativeExamples,
        provider,
        model,
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

  // Salva apenas configurações avançadas
  const saveAdvancedSettings = async () => {
    try {
      setSavingAdvanced(true);
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
        negativeExamples,
        provider,
        model,
        temperature,
        maxTokens,
        autoReplyEnabled,
      });

      setKnowledge(response.data);

      // Feedback visual
      setTimeout(() => {
        setSavingAdvanced(false);
      }, 1000);
    } catch (err: any) {
      console.error("Error saving advanced settings:", err);
      setError(err.response?.data?.message || "Erro ao salvar configurações avançadas");
      setSavingAdvanced(false);
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
      case "negativeExamples":
        setNegativeExamples(value);
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
    <div className={spacing.page}>
      <div className={spacing.section}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`${typography.pageTitle} flex items-center gap-3`}>
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
          <ExpandableTextarea
            id="companyInfo"
            label="Sobre sua empresa"
            description="Descreva o que você faz, vende, história da empresa, missão e valores..."
            placeholder="Ex: Somos uma empresa especializada em manutenção e instalação de ar condicionado..."
            value={companyInfo}
            onChange={(value) => handleFieldChange("companyInfo", value)}
            rows={6}
          />

          {/* Produtos e Serviços */}
          <ExpandableTextarea
            id="productsServices"
            label="Produtos e Serviços"
            description="Liste produtos, preços, descrições detalhadas, categorias, variações..."
            placeholder="Ex: Instalação de ar split 12.000 BTUs - R$ 350,00..."
            value={productsServices}
            onChange={(value) => handleFieldChange("productsServices", value)}
            rows={8}
          />

          {/* Tom de Voz */}
          <ExpandableTextarea
            id="toneInstructions"
            label="Tom de Voz e Instruções"
            description="Defina o tom e estilo de comunicação da IA"
            placeholder="Ex: Seja informal e use emojis. Se apresente como 'Assistente Virtual da ClimaTech'..."
            value={toneInstructions}
            onChange={(value) => handleFieldChange("toneInstructions", value)}
            rows={6}
          />

          {/* Políticas Importantes */}
          <ExpandableTextarea
            id="policies"
            label="Políticas Importantes"
            description="Prazos de entrega, garantias, pagamentos, horários, trocas e devoluções..."
            placeholder="Ex: Atendimento de segunda a sexta, 8h às 18h. Aceitamos PIX, cartão e dinheiro..."
            value={policies}
            onChange={(value) => handleFieldChange("policies", value)}
            rows={6}
          />

          {/* Exemplos Negativos - Anti-Exemplos */}
          <ExpandableTextarea
            id="negativeExamples"
            label="❌ Exemplos Negativos - O que NÃO fazer"
            description="Ensine a IA comportamentos que ela NUNCA deve ter. Exemplos de respostas ruins, tom inadequado, abordagens erradas..."
            placeholder="Ex: Nunca seja grosseiro ou impaciente com o cliente. Não use linguagem muito técnica que o cliente não entenda. Não prometa prazos impossíveis..."
            value={negativeExamples}
            onChange={(value) => handleFieldChange("negativeExamples", value)}
            rows={6}
          />

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

          {/* Provider e Modelo da IA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor de IA</Label>
              <Select
                value={provider}
                onValueChange={(value: "openai" | "anthropic") => {
                  setProvider(value);
                  // Define modelo padrão ao trocar de provedor
                  if (value === "openai") {
                    setModel("gpt-4o-mini");
                  } else {
                    setModel("claude-sonnet-4-5-20250929");
                  }
                }}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Select
                value={model}
                onValueChange={setModel}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {provider === "openai" ? (
                    <>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (Econômico)</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o (Avançado)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Mais recente)</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-opus-20240229">Claude 3 Opus (Mais inteligente)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            {provider === "openai"
              ? model === "gpt-4o-mini"
                ? "💰 Mais rápido e econômico - Ideal para atendimento em escala"
                : model === "gpt-4o"
                ? "⚡ Modelo mais avançado da OpenAI - Melhor raciocínio e qualidade"
                : "🚀 Ótimo equilíbrio entre velocidade e qualidade"
              : model === "claude-sonnet-4-5-20250929"
              ? "🌟 Modelo mais recente - Respostas excepcionais e contexto longo"
              : model === "claude-3-opus-20240229"
              ? "🧠 Máxima inteligência - Ideal para casos complexos"
              : "⚡ Rápido e inteligente - Ótimo para conversas"}
          </p>

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

          {/* Botão Salvar Configurações Avançadas */}
          <div className="flex items-center justify-end pt-4 border-t">
            <Button
              onClick={saveAdvancedSettings}
              disabled={savingAdvanced}
              size="lg"
              variant="default"
            >
              {savingAdvanced ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Salvo!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações Avançadas
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
