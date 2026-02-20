"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  Zap,
  MessageSquare,
  Play,
  Eye,
  EyeOff,
  Pencil,
  X,
  Bot,
  AlertCircle,
  Loader2,
  Tag,
  Settings2,
  List,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { intentScriptsApi, IntentScriptData, IntentScriptPhase } from "@/lib/intent-scripts";

// ============================================
// TYPES
// ============================================

type PhaseType = "trigger" | "question" | "action" | "output";

const PHASE_META: Record<PhaseType, { label: string; icon: string; color: string; bg: string; border: string; desc: string }> = {
  trigger: {
    label: "Gatilho",
    icon: "🎯",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    desc: "Quando o script é ativado",
  },
  question: {
    label: "Pergunta",
    icon: "❓",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    desc: "Dado a ser coletado",
  },
  action: {
    label: "Ação",
    icon: "⚡",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "Ação que a IA executa",
  },
  output: {
    label: "Saída",
    icon: "📤",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    desc: "Finalização do script",
  },
};

// Estados da UI
type View = "list" | "editor";

// ============================================
// SUB-COMPONENTS
// ============================================

function Badge({ text, onRemove }: { text: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/10">
      {text}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:text-red-400 transition-colors"
          type="button"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 bg-white/5 rounded-lg border border-white/10 min-h-[42px]">
        {values.map((v) => (
          <Badge key={v} text={v} onRemove={() => onChange(values.filter((x) => x !== v))} />
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={values.length === 0 ? placeholder : "Adicionar..."}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
        />
      </div>
      <p className="text-xs text-white/30">Pressione Enter ou vírgula para adicionar</p>
    </div>
  );
}

// ============================================
// PHASE CARD (editor inline)
// ============================================

function PhaseCard({
  phase,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  phase: IntentScriptPhase;
  index: number;
  total: number;
  onChange: (updated: IntentScriptPhase) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const meta = PHASE_META[phase.type];
  const [editing, setEditing] = useState(false);

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle + index */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} className="rotate-[-90deg]" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} className="rotate-90" />
          </button>
        </div>

        {/* Icon + type */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl">{phase.icon || meta.icon}</span>
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>{meta.label}</p>
            <p className="text-sm font-medium text-white truncate">{phase.title || "Sem título"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
          >
            {editing ? <X size={14} /> : <Pencil size={14} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Inline editor */}
      {editing && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Tipo</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(PHASE_META) as PhaseType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...phase, type: t })}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-all ${phase.type === t
                    ? `${PHASE_META[t].bg} ${PHASE_META[t].border} ${PHASE_META[t].color}`
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                    }`}
                >
                  <span>{PHASE_META[t].icon}</span>
                  {PHASE_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji picker simples */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Emoji</label>
              <input
                value={phase.icon}
                onChange={(e) => onChange({ ...phase, icon: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
                placeholder="🎯"
                maxLength={4}
              />
            </div>
            <div className="flex-[3] space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Título</label>
              <input
                value={phase.title}
                onChange={(e) => onChange({ ...phase, title: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
                placeholder="Ex: Tipo de Equipamento"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/40 uppercase tracking-wider">Instrução para a IA</label>
            <textarea
              value={phase.description}
              onChange={(e) => onChange({ ...phase, description: e.target.value })}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 resize-none"
              placeholder="Descreva o que a IA deve fazer ou perguntar nesta fase..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SCRIPT FLOW PREVIEW (read-only visual)
// ============================================

function FlowPreview({ phases }: { phases: IntentScriptPhase[] }) {
  if (phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-white/20">
        <Bot size={32} className="mb-2" />
        <p className="text-sm">Adicione fases para visualizar o fluxo</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {phases.map((phase, i) => {
        const meta = PHASE_META[phase.type];
        return (
          <div key={phase.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${meta.bg} border ${meta.border}`}>
                {phase.icon || meta.icon}
              </div>
              {i < phases.length - 1 && (
                <div className="w-px h-4 bg-white/10 mt-1" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <p className={`text-xs font-semibold uppercase ${meta.color}`}>{meta.label}</p>
              <p className="text-sm text-white font-medium">{phase.title || "Sem título"}</p>
              {phase.description && (
                <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{phase.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// SCRIPT EDITOR
// ============================================

function ScriptEditor({
  script,
  onSave,
  onDelete,
  onBack,
  isSaving,
}: {
  script: IntentScriptData | null; // null = creating new
  onSave: (data: Partial<IntentScriptData>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onBack: () => void;
  isSaving: boolean;
}) {
  const isCreating = !script;

  const [label, setLabel] = useState(script?.label ?? "");
  const [enabled, setEnabled] = useState(script?.enabled ?? true);
  const [triggers, setTriggers] = useState<string[]>(script?.triggers ?? []);
  const [requiredData, setRequiredData] = useState<string[]>(script?.requiredData ?? []);
  const [phases, setPhases] = useState<IntentScriptPhase[]>(script?.phases ?? []);
  const [customInstructions, setCustomInstructions] = useState(script?.customInstructions ?? "");
  const [activeTab, setActiveTab] = useState<"phases" | "triggers" | "settings">("phases");

  const addPhase = (type: PhaseType) => {
    const meta = PHASE_META[type];
    const newPhase: IntentScriptPhase = {
      id: `phase_${Date.now()}`,
      type,
      icon: meta.icon,
      title: "",
      description: "",
    };
    setPhases([...phases, newPhase]);
  };

  const updatePhase = (index: number, updated: IntentScriptPhase) => {
    const next = [...phases];
    next[index] = updated;
    setPhases(next);
  };

  const deletePhase = (index: number) => {
    setPhases(phases.filter((_, i) => i !== index));
  };

  const movePhase = (from: number, to: number) => {
    if (to < 0 || to >= phases.length) return;
    const next = [...phases];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setPhases(next);
  };

  const handleSave = () => {
    if (!label.trim()) {
      toast.error("O nome do script é obrigatório");
      return;
    }
    if (triggers.length === 0) {
      toast.error("Adicione pelo menos um trigger (palavra-chave)");
      return;
    }
    onSave({ label, enabled, triggers, requiredData, phases, customInstructions });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-xs text-white/40 uppercase tracking-wider">{isCreating ? "Novo" : "Editando"}</p>
          <h2 className="text-lg font-semibold text-white">{label || "Script sem nome"}</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isCreating && (
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${enabled
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/40"
                }`}
            >
              {enabled ? <Eye size={14} /> : <EyeOff size={14} />}
              {enabled ? "Ativo" : "Inativo"}
            </button>
          )}
          {!isCreating && onDelete && (
            <button
              onClick={onDelete}
              className="p-2 rounded-xl hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isCreating ? "Criar Script" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Name input */}
      <div className="mb-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome do script (ex: Instalação de Ar Condicionado)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-base font-medium placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
        {([
          { id: "phases", icon: List, label: "Fases" },
          { id: "triggers", icon: Tag, label: "Triggers" },
          { id: "settings", icon: Settings2, label: "Avançado" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
              }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "phases" && (
          <div className="space-y-6">
            {/* Flow preview */}
            {phases.length > 0 && (
              <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Play size={11} /> Preview do Fluxo
                </p>
                <FlowPreview phases={phases} />
              </div>
            )}

            {/* Phase list */}
            <div className="space-y-2">
              {phases.map((phase, i) => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  index={i}
                  total={phases.length}
                  onChange={(updated) => updatePhase(i, updated)}
                  onDelete={() => deletePhase(i)}
                  onMoveUp={() => movePhase(i, i - 1)}
                  onMoveDown={() => movePhase(i, i + 1)}
                />
              ))}
            </div>

            {/* Add phase buttons */}
            <div>
              <p className="text-xs font-medium text-white/30 uppercase tracking-wider mb-2">Adicionar Fase</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PHASE_META) as PhaseType[]).map((type) => {
                  const meta = PHASE_META[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addPhase(type)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${meta.border} ${meta.bg} ${meta.color} text-sm font-medium hover:opacity-80 transition-all`}
                    >
                      <Plus size={14} />
                      <span>{meta.icon}</span>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "triggers" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <AlertCircle size={16} className="text-violet-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-violet-300/80">
                <p className="font-medium text-violet-300 mb-1">Como os triggers funcionam</p>
                <p>Quando o cliente enviar uma mensagem contendo qualquer uma dessas palavras ou frases, o script será ativado automaticamente.</p>
              </div>
            </div>

            <TagInput
              label="Palavras-chave (triggers)"
              placeholder='Ex: "instalar ar", "instalação de ar"'
              values={triggers}
              onChange={setTriggers}
            />

            <TagInput
              label="Dados obrigatórios a coletar"
              placeholder='Ex: "tipo do equipamento", "quantidade de btus"'
              values={requiredData}
              onChange={setRequiredData}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            {!isCreating && (
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">Script ativo</p>
                  <p className="text-xs text-white/40 mt-0.5">Quando desativado, o script não será executado</p>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative w-11 h-6 rounded-full transition-all ${enabled ? "bg-violet-600" : "bg-white/10"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5.5 left-0.5" : "left-0.5"
                      }`}
                  />
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Instruções personalizadas para a IA
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={6}
                placeholder="Instruções adicionais específicas para este script. Ex: sempre oferecer desconto para pacotes de 2 ou mais aparelhos..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 resize-none"
              />
              <p className="text-xs text-white/30">
                Estas instruções são adicionadas ao final do script e têm prioridade máxima.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SCRIPT LIST CARD
// ============================================

function ScriptCard({
  script,
  onSelect,
  onToggle,
}: {
  script: IntentScriptData;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const phaseCount = script.phases?.length ?? 0;
  const triggerCount = (script.triggers?.length ?? 0) + (script.customTriggers?.length ?? 0);

  return (
    <div
      className={`group relative rounded-2xl border transition-all cursor-pointer ${script.enabled
        ? "bg-white/5 border-white/10 hover:border-violet-500/40 hover:bg-white/8"
        : "bg-white/3 border-white/5 opacity-60 hover:opacity-80"
        }`}
      onClick={onSelect}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Bot size={15} className="text-violet-400 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-white truncate">{script.label}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30">
              <span className="flex items-center gap-1">
                <List size={10} />
                {phaseCount} {phaseCount === 1 ? "fase" : "fases"}
              </span>
              <span className="flex items-center gap-1">
                <Tag size={10} />
                {triggerCount} {triggerCount === 1 ? "trigger" : "triggers"}
              </span>
            </div>
          </div>

          {/* Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-all ${script.enabled ? "bg-violet-600" : "bg-white/10"
              }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${script.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
            />
          </button>
        </div>

        {/* Mini flow preview */}
        {script.phases && script.phases.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {script.phases.slice(0, 5).map((phase, i) => {
              const meta = PHASE_META[phase.type];
              return (
                <div key={phase.id} className="flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.bg} ${meta.color} border ${meta.border}`}
                  >
                    {phase.icon || meta.icon} {phase.title || meta.label}
                  </span>
                  {i < Math.min(script.phases.length - 1, 4) && (
                    <ArrowRight size={10} className="text-white/20" />
                  )}
                </div>
              );
            })}
            {script.phases.length > 5 && (
              <span className="text-xs text-white/30">+{script.phases.length - 5} mais</span>
            )}
          </div>
        )}
      </div>

      {/* Edit indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={13} className="text-white/30" />
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function IntentScriptsPage() {
  const [scripts, setScripts] = useState<IntentScriptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [selectedScript, setSelectedScript] = useState<IntentScriptData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadScripts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await intentScriptsApi.listScripts();
      setScripts(res.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar scripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const handleBack = () => {
    setView("list");
    setSelectedScript(null);
    setIsCreating(false);
  };

  const handleSelectScript = (script: IntentScriptData) => {
    setSelectedScript(script);
    setIsCreating(false);
    setView("editor");
  };

  const handleCreateNew = () => {
    setSelectedScript(null);
    setIsCreating(true);
    setView("editor");
  };

  const handleToggleEnabled = async (script: IntentScriptData) => {
    try {
      await intentScriptsApi.updateScript(script.id, { enabled: !script.enabled });
      setScripts((prev) =>
        prev.map((s) => (s.id === script.id ? { ...s, enabled: !s.enabled } : s))
      );
      toast.success(script.enabled ? "Script desativado" : "Script ativado");
    } catch {
      toast.error("Erro ao atualizar script");
    }
  };

  const handleSave = async (data: Partial<IntentScriptData>) => {
    setIsSaving(true);
    try {
      if (isCreating) {
        const res = await intentScriptsApi.createScript({
          label: data.label!,
          triggers: data.triggers ?? [],
          requiredData: data.requiredData ?? [],
          phases: data.phases ?? [],
          customInstructions: data.customInstructions,
        });
        setScripts((prev) => [...prev, res.data]);
        toast.success("Script criado com sucesso!");
        setSelectedScript(res.data);
        setIsCreating(false);
        setView("list");
      } else if (selectedScript) {
        const res = await intentScriptsApi.updateScript(selectedScript.id, data);
        setScripts((prev) =>
          prev.map((s) => (s.id === selectedScript.id ? res.data : s))
        );
        toast.success("Script salvo!");
        setView("list");
      }
    } catch {
      toast.error("Erro ao salvar script");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedScript) return;
    if (!confirm(`Tem certeza que deseja excluir o script "${selectedScript.label}"?`)) return;

    setIsSaving(true);
    try {
      await intentScriptsApi.deleteScript(selectedScript.id);
      setScripts((prev) => prev.filter((s) => s.id !== selectedScript.id));
      toast.success("Script excluído");
      handleBack();
    } catch {
      toast.error("Erro ao excluir script");
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {view === "list" ? (
          <>
            {/* Page header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Zap size={16} className="text-violet-400" />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Scripts de Intenção</h1>
                </div>
                <p className="text-sm text-white/40 ml-10">
                  Configure fluxos de atendimento que a IA segue quando detecta uma intenção específica do cliente.
                </p>
              </div>

              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/20"
              >
                <Plus size={16} />
                Novo Script
              </button>
            </div>

            {/* How it works banner */}
            <div className="mb-6 p-4 bg-blue-500/8 border border-blue-500/15 rounded-2xl">
              <div className="flex items-start gap-3">
                <Bot size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-300 mb-1">Como funciona</p>
                  <p className="text-blue-300/60 leading-relaxed">
                    Quando um cliente mencionar qualquer palavra-chave configurada, a IA entra
                    no script e segue o fluxo definido, coletando informações uma por uma.
                    O script persiste durante toda a conversa até que o cliente mude de assunto
                    ou peça para cancelar.
                  </p>
                </div>
              </div>
            </div>

            {/* Script list */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-white/20" />
              </div>
            ) : scripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                  <MessageSquare size={28} className="text-white/20" />
                </div>
                <h3 className="text-base font-semibold text-white/60 mb-1">Nenhum script criado</h3>
                <p className="text-sm text-white/30 max-w-xs mb-6">
                  Crie seu primeiro script para que a IA siga um roteiro estruturado quando detectar uma intenção específica.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
                >
                  <Plus size={16} />
                  Criar primeiro script
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scripts.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onSelect={() => handleSelectScript(script)}
                    onToggle={() => handleToggleEnabled(script)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <ScriptEditor
            script={isCreating ? null : selectedScript}
            onSave={handleSave}
            onDelete={selectedScript ? handleDelete : undefined}
            onBack={handleBack}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
