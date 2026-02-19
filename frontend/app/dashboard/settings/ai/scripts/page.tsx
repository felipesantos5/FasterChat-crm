"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Wrench,
  Sparkles,
  Zap,
  Plus,
  X,
  Save,
  ArrowRight,
  Loader2,
  Settings2,
  Info,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntentScriptPhase {
  id: string;
  title: string;
  icon: string;
  description: string;
  type: "trigger" | "question" | "action" | "output";
}

interface IntentScript {
  id: string;
  label: string;
  triggers: string[];
  requiredData: string[];
  phases: IntentScriptPhase[];
  enabled: boolean;
  customTriggers: string[];
  customInstructions: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchScripts(): Promise<IntentScript[]> {
  const res = await fetch("/api/ai/intent-scripts", { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar scripts");
  const json = await res.json();
  return json.data;
}

async function saveScripts(scripts: IntentScript[]) {
  const res = await fetch("/api/ai/intent-scripts", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scripts: scripts.map(s => ({
        id: s.id,
        enabled: s.enabled,
        customTriggers: s.customTriggers,
        customInstructions: s.customInstructions
      }))
    }),
  });
  if (!res.ok) throw new Error("Falha ao salvar configuração");
  return res.json();
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  trigger: "bg-blue-100 border-blue-200 text-blue-700",
  question: "bg-green-100 border-green-200 text-green-700",
  action: "bg-purple-100 border-purple-200 text-purple-700",
  output: "bg-orange-100 border-orange-200 text-orange-700",
};

const PHASE_DOTS: Record<string, string> = {
  trigger: "bg-blue-500",
  question: "bg-green-500",
  action: "bg-purple-500",
  output: "bg-orange-500",
};

const PHASE_LABELS: Record<string, string> = {
  trigger: "Gatilho",
  question: "Pergunta",
  action: "Ação",
  output: "Saída",
};

// ─── Flow Node ───────────────────────────────────────────────────────────────

function FlowNode({ phase, isLast }: { phase: IntentScriptPhase; isLast: boolean }) {
  const colorClass = PHASE_COLORS[phase.type] || "bg-gray-100 border-gray-200 text-gray-700";
  const dotClass = PHASE_DOTS[phase.type] || "bg-gray-500";

  return (
    <div className="flex flex-col items-center min-w-[220px] max-w-[240px]">
      <Card className={`w-full border-2 shadow-sm relative ${colorClass}`}>
        <div className="absolute -top-3 left-4">
          <Badge variant="outline" className={`${colorClass} border-current text-[10px] font-bold uppercase tracking-wider bg-white`}>
            {PHASE_LABELS[phase.type]}
          </Badge>
        </div>

        <CardContent className="pt-6 pb-4 px-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{phase.icon}</span>
            <span className="font-bold text-sm leading-tight text-gray-900">
              {phase.title}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-gray-600">
            {phase.description}
          </p>
        </CardContent>

        {!isLast && (
          <div className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white ${dotClass}`} />
        )}
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function IntentScriptsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local state for editing before save
  const [editedScripts, setEditedScripts] = useState<IntentScript[]>([]);

  useEffect(() => {
    fetchScripts()
      .then(data => {
        setEditedScripts(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Erro ao carregar scripts de atendimento");
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedScript = editedScripts.find(s => s.id === selectedId);

  const updateScript = useCallback((id: string, partial: Partial<IntentScript>) => {
    setEditedScripts(prev => prev.map(s =>
      s.id === id ? { ...s, ...partial } : s
    ));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveScripts(editedScripts);
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = () => {
    toast.info("A criação de fluxos customizados estará disponível em breve!");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">Carregando scripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-green-600">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scripts de Atendimento</h1>
            <p className="text-base text-gray-500 font-medium">Automatize conversas com base na intenção detectada</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-2 font-semibold text-gray-700"
            onClick={handleCreateNew}
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Fluxo
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-11 px-6 shadow-md"
          >
            {saving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Salvar Tudo
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden p-6 gap-6">
        {/* Sidebar Script List */}
        <div className="w-80 flex flex-col gap-4">
          <Card className="flex-1 shadow-sm border-2 overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Fluxos Disponíveis</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 flex flex-col gap-2">
                {editedScripts.map(script => (
                  <button
                    key={script.id}
                    onClick={() => setSelectedId(script.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all border-2 group ${selectedId === script.id
                      ? "bg-green-50 border-green-200 ring-2 ring-green-100"
                      : "bg-white border-transparent hover:border-gray-100 hover:bg-gray-50"
                      }`}
                  >
                    <div className={`p-2 rounded-lg ${selectedId === script.id ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500 group-hover:bg-white"
                      }`}>
                      {script.id.includes('installation') && <Zap size={20} />}
                      {script.id.includes('maintenance') && <Wrench size={20} />}
                      {script.id.includes('cleaning') && <Sparkles size={20} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-base truncate ${selectedId === script.id ? "text-green-900" : "text-gray-700"}`}>
                        {script.label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={script.enabled ? "default" : "secondary"} className={`text-[10px] h-4 px-1 ${script.enabled ? "bg-green-500" : "bg-gray-400"}`}>
                          {script.enabled ? "ATIVO" : "DESATIVADO"}
                        </Badge>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {script.phases?.length || 0} fases
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* <Card className="shadow-sm border-2 bg-blue-50/50 border-blue-100">
            <CardContent className="p-4 flex gap-3 text-blue-800">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">
                A IA detecta a intenção do cliente usando os <strong>gatilhos</strong> e aplica o script configurado automaticamente.
              </p>
            </CardContent>
          </Card> */}
        </div>

        {/* Main Editor Section */}
        <div className="flex-1 overflow-hidden flex flex-col gap-6">
          {selectedScript ? (
            <>
              {/* Visualization Card */}
              <Card className="shadow-sm border-2 bg-white">
                <CardHeader className="pb-2 flex flex-row items-center justify-between border-b mb-6 bg-gray-50/30">
                  <div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      {selectedScript.label}
                      <Badge variant="outline" className="ml-2 font-mono text-xs font-normal text-gray-400 border-gray-200">
                        {selectedScript.id}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-gray-500 mt-1">
                      Visualização do fluxo linear seguido pela Inteligência Artificial
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-full border-2 shadow-sm">
                    <Label htmlFor="script-active" className="font-bold text-sm cursor-pointer select-none">
                      {selectedScript.enabled ? "Fluxo Ativado" : "Fluxo Desativado"}
                    </Label>
                    <Switch
                      id="script-active"
                      checked={selectedScript.enabled}
                      onCheckedChange={(val) => updateScript(selectedScript.id, { enabled: val })}
                    />
                  </div>
                </CardHeader>

                <CardContent className="pb-8 pt-2">
                  <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <div className="flex items-start gap-0 min-w-max px-2 py-4">
                      {(selectedScript.phases || []).map((phase, i) => (
                        <React.Fragment key={phase.id}>
                          <FlowNode phase={phase} isLast={i === (selectedScript.phases?.length || 0) - 1} />
                          {i < (selectedScript.phases?.length || 0) - 1 && (
                            <div className="flex items-center justify-center w-16 h-10 mt-10">
                              <ArrowRight className="text-gray-200 h-8 w-8" strokeWidth={1.5} />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Configuration Section */}
              <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
                {/* Triggers Section */}
                <Card className="shadow-sm border-2 flex flex-col overflow-hidden">
                  <CardHeader className="py-4 border-b bg-gray-50/50">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Zap size={18} className="text-amber-500" />
                      Gatilhos de Ativação
                    </CardTitle>
                    <CardDescription className="text-xs">Palavras que fazem a IA iniciar este fluxo</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div>
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Gatilhos do Sistema</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedScript.triggers?.map((t, i) => (
                          <Badge key={i} variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100 font-medium px-2 py-1">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-gray-900 block">Gatilhos Customizados</Label>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: precinho, orçamento agendado..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.currentTarget.value.trim().toLowerCase();
                                if (val && !selectedScript.customTriggers.includes(val)) {
                                  updateScript(selectedScript.id, {
                                    customTriggers: [...selectedScript.customTriggers, val]
                                  });
                                  e.currentTarget.value = '';
                                }
                              }
                            }}
                            className="bg-white border-2"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedScript.customTriggers.map((t, i) => (
                            <Badge key={i} className="bg-blue-600 text-white font-bold pr-1 pl-2.5 py-1">
                              {t}
                              <button
                                onClick={() => updateScript(selectedScript.id, {
                                  customTriggers: selectedScript.customTriggers.filter((_, idx) => idx !== i)
                                })}
                                className="ml-2 hover:bg-blue-700 rounded-full p-0.5"
                              >
                                <X size={12} />
                              </button>
                            </Badge>
                          ))}
                          {selectedScript.customTriggers.length === 0 && (
                            <p className="text-sm text-gray-400 italic">Nenhum gatilho extra adicionado.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Data & Instructions Section */}
                <Card className="shadow-sm border-2 flex flex-col overflow-hidden">
                  <CardHeader className="py-4 border-b bg-gray-50/50">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Settings2 size={18} className="text-blue-500" />
                      Instruções & Dados
                    </CardTitle>
                    <CardDescription className="text-xs">O que a IA deve coletar e como deve agir</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div>
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">Dados Solicitados</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedScript.requiredData?.map((d, i) => (
                          <Badge key={i} variant="outline" className="border-2 border-blue-100 text-blue-600 font-mono text-[11px] px-2">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full" />

                    <div className="space-y-4">
                      <Label className="text-sm font-bold text-gray-900 block">Instruções Adicionais</Label>
                      <Textarea
                        placeholder="Ex: Fale sempre de forma formal, ofereça desconto de 10% se o cliente fechar na hora..."
                        value={selectedScript.customInstructions}
                        onChange={(e) => updateScript(selectedScript.id, { customInstructions: e.target.value })}
                        className="min-h-[140px] resize-none border-2 bg-white font-medium leading-relaxed"
                      />
                      <p className="text-[11px] text-gray-400">
                        Essas instruções serão injetadas no prompt da IA quando este fluxo estiver ativo.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-12 border-4 border-dashed rounded-3xl border-gray-100 bg-white/50">
              <div className="text-center">
                <div className="bg-gray-100 p-6 rounded-full inline-block mb-4">
                  <Zap size={48} className="text-gray-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-400">Selecione um script para editar</h2>
                <p className="text-gray-400 mt-2">Escolha uma intenção da lista lateral para configurar seu fluxo.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
