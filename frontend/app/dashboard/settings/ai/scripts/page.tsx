"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Zap,
  MessageSquare,
  Eye,
  EyeOff,
  X,
  Bot,
  Loader2,
  Tag,
  ArrowRight,
  Sparkles,
  FileText,
  HelpCircle,
  ClipboardList,
  Search,
  ToggleLeft,
  ToggleRight,
  Info,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  intentScriptsApi,
  IntentScriptData,
  IntentScriptPhase,
} from "@/lib/intent-scripts";

// ============================================
// TYPES & CONSTANTS
// ============================================

type PhaseType = "trigger" | "question" | "action" | "output";
type View = "list" | "editor";

// Cores simplificadas usando o sistema de design do site (verde)
const STEP_COLORS: Record<
  PhaseType,
  { accent: string; bg: string; border: string; badge: string }
> = {
  trigger: {
    accent: "text-primary",
    bg: "bg-accent",
    border: "border-primary/20",
    badge: "bg-primary/10 text-primary",
  },
  question: {
    accent: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  action: {
    accent: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  output: {
    accent: "text-primary",
    bg: "bg-accent",
    border: "border-primary/20",
    badge: "bg-primary/10 text-primary",
  },
};

const STEP_LABELS: Record<PhaseType, string> = {
  trigger: "Gatilho",
  question: "Pergunta",
  action: "Ação",
  output: "Saída",
};

const STEP_ICONS_DEFAULT: Record<PhaseType, string> = {
  trigger: "🎯",
  question: "❓",
  action: "⚡",
  output: "📤",
};

const EMOJI_SUGGESTIONS = [
  "🎯", "❓", "⚡", "📤", "📞", "📸", "📍", "💰", "🔧",
  "❄️", "🏠", "📋", "✅", "⏰", "🛠️", "📦", "🔍", "💬",
  "📐", "🧰", "🗓️", "📝", "🤝", "⭐",
];

// ============================================
// SUB-COMPONENTS
// ============================================

function TagBadge({
  text,
  onRemove,
}: {
  text: string;
  onRemove?: () => void;
}) {
  return (
    <span className="group/tag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent text-accent-foreground border border-primary/20 transition-all hover:bg-primary/15">
      <Tag size={10} className="opacity-60" />
      {text}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-all"
          type="button"
        >
          <X size={11} />
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
  helperText,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  helperText?: string;
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
      <label className="text-sm font-medium text-zinc-700">{label}</label>
      <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-zinc-200 min-h-[52px] focus-within:border-primary/40 transition-colors">
        {values.map((v) => (
          <TagBadge
            key={v}
            text={v}
            onRemove={() => onChange(values.filter((x) => x !== v))}
          />
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
          className="flex-1 min-w-[140px] bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 outline-none"
        />
      </div>
      {helperText && (
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Info size={10} />
          {helperText}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-accent border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent text-primary border border-primary/20">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// STEP CARD (editor de passo)
// ============================================

function StepCard({
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
  const colors = STEP_COLORS[phase.type];
  const [expanded, setExpanded] = useState(!phase.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div
      className={`group rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all duration-200 hover:shadow-md`}
    >
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Step number + reorder */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={index === 0}
            className="text-zinc-400 hover:text-zinc-600 disabled:opacity-0 transition-all p-0.5"
          >
            <ChevronUp size={12} />
          </button>
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${colors.badge}`}
          >
            {index + 1}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={index === total - 1}
            className="text-zinc-400 hover:text-zinc-600 disabled:opacity-0 transition-all p-0.5"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Icon + title */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">
            {phase.icon || STEP_ICONS_DEFAULT[phase.type]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${colors.accent}`}
              >
                {STEP_LABELS[phase.type]}
              </span>
            </div>
            <p className="text-sm font-medium text-zinc-800 truncate">
              {phase.title || "Passo sem título"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 text-zinc-400 hover:text-red-500 transition-all"
          >
            <Trash2 size={13} />
          </button>
          <div
            className={`p-1.5 rounded-lg transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <ChevronDown size={14} className="text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Type selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500">
              Tipo do passo
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(STEP_LABELS) as PhaseType[]).map((t) => {
                const c = STEP_COLORS[t];
                return (
                  <button
                    key={t}
                    onClick={() => onChange({ ...phase, type: t })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${phase.type === t
                        ? `${c.bg} ${c.border} ${c.accent}`
                        : "bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                      }`}
                  >
                    {STEP_ICONS_DEFAULT[t]} {STEP_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emoji + Title */}
          <div className="flex gap-3">
            <div className="relative">
              <label className="text-xs font-medium text-zinc-500 block mb-1.5">
                Ícone
              </label>
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-12 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-lg hover:bg-zinc-50 transition-colors"
              >
                {phase.icon || STEP_ICONS_DEFAULT[phase.type]}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-1 z-20 p-2 bg-white border border-zinc-200 rounded-xl shadow-xl w-[220px]">
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJI_SUGGESTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onChange({ ...phase, icon: emoji });
                          setShowEmojiPicker(false);
                        }}
                        className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-base transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-500 block mb-1.5">
                Título do passo
              </label>
              <input
                value={phase.title}
                onChange={(e) => onChange({ ...phase, title: e.target.value })}
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-primary/40 transition-colors"
                placeholder="Ex: Verificar se já comprou o equipamento"
              />
            </div>
          </div>

          {/* Description / AI instruction */}
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1.5">
              Instrução para a IA
            </label>
            <textarea
              value={phase.description}
              onChange={(e) =>
                onChange({ ...phase, description: e.target.value })
              }
              rows={3}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-primary/40 resize-none transition-colors leading-relaxed"
              placeholder="Descreva detalhadamente o que a IA deve fazer ou perguntar neste passo. Exemplo: Pergunte se o cliente já comprou o equipamento. Se não comprou, ofereça ajuda na escolha de marca e envie os valores disponíveis."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SCRIPT CARD (lista)
// ============================================

function ScriptCard({
  script,
  onSelect,
  onToggle,
  onDuplicate,
}: {
  script: IntentScriptData;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  const phaseCount = script.phases?.length ?? 0;
  const triggerCount =
    (script.triggers?.length ?? 0) + (script.customTriggers?.length ?? 0);

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${script.enabled
          ? "bg-white border-zinc-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
          : "bg-zinc-50 border-zinc-200 opacity-50 hover:opacity-70"
        }`}
      onClick={onSelect}
    >
      {/* Active indicator bar */}
      {script.enabled && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-primary/70 rounded-t-xl" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-accent border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-800 truncate">
                  {script.label}
                </h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <ClipboardList size={10} />
                    {phaseCount} {phaseCount === 1 ? "passo" : "passos"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Tag size={10} />
                    {triggerCount}{" "}
                    {triggerCount === 1 ? "gatilho" : "gatilhos"}
                  </span>
                </div>
              </div>
            </div>

            {/* Mini flow preview */}
            {script.phases && script.phases.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {script.phases.slice(0, 4).map((phase, i) => {
                  const colors = STEP_COLORS[phase.type];
                  return (
                    <div key={phase.id} className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium ${colors.bg} ${colors.accent} border ${colors.border}`}
                      >
                        {phase.icon || STEP_ICONS_DEFAULT[phase.type]}{" "}
                        <span className="max-w-[80px] truncate">
                          {phase.title || STEP_LABELS[phase.type]}
                        </span>
                      </span>
                      {i < Math.min(script.phases.length - 1, 3) && (
                        <ArrowRight size={10} className="text-zinc-300" />
                      )}
                    </div>
                  );
                })}
                {script.phases.length > 4 && (
                  <span className="text-[11px] text-zinc-400 ml-1">
                    +{script.phases.length - 4} mais
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className={`flex items-center gap-1 transition-all ${script.enabled ? "text-primary" : "text-zinc-300"
                }`}
              title={script.enabled ? "Desativar script" : "Ativar script"}
            >
              {script.enabled ? (
                <ToggleRight size={28} />
              ) : (
                <ToggleLeft size={28} />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-all"
              title="Duplicar script"
            >
              <Copy size={13} />
            </button>
          </div>
        </div>
      </div>
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
  script: IntentScriptData | null;
  onSave: (data: Partial<IntentScriptData>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onBack: () => void;
  isSaving: boolean;
}) {
  const isCreating = !script;

  const [label, setLabel] = useState(script?.label ?? "");
  const [enabled, setEnabled] = useState(script?.enabled ?? true);
  const [triggers, setTriggers] = useState<string[]>(
    script?.triggers ?? []
  );
  const [requiredData, setRequiredData] = useState<string[]>(
    script?.requiredData ?? []
  );
  const [phases, setPhases] = useState<IntentScriptPhase[]>(
    script?.phases ?? []
  );
  const [customInstructions, setCustomInstructions] = useState(
    script?.customInstructions ?? ""
  );

  const stepsEndRef = useRef<HTMLDivElement>(null);

  const addPhase = (type: PhaseType) => {
    const newPhase: IntentScriptPhase = {
      id: `phase_${Date.now()}`,
      type,
      icon: STEP_ICONS_DEFAULT[type],
      title: "",
      description: "",
    };
    setPhases([...phases, newPhase]);
    setTimeout(() => {
      stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
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
      toast.error("Adicione pelo menos uma palavra-chave (gatilho)");
      return;
    }
    onSave({
      label,
      enabled,
      triggers,
      requiredData,
      phases,
      customInstructions,
    });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-all border border-zinc-200"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest font-semibold">
            {isCreating ? "Novo Script" : "Editando Script"}
          </p>
          <h2 className="text-lg font-bold text-zinc-800 truncate">
            {label || "Script sem nome"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!isCreating && (
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${enabled
                  ? "bg-accent border-primary/20 text-primary"
                  : "bg-white border-zinc-200 text-zinc-400"
                }`}
            >
              {enabled ? <Eye size={13} /> : <EyeOff size={13} />}
              {enabled ? "Ativo" : "Inativo"}
            </button>
          )}
          {!isCreating && onDelete && (
            <button
              onClick={onDelete}
              className="p-2.5 rounded-xl hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all border border-transparent hover:border-red-200"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-md shadow-primary/20"
          >
            {isSaving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {isCreating ? "Criar Script" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-5 pb-8">
        {/* ── Section 1: Basic Info ── */}
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader
            icon={FileText}
            title="Informações do Script"
            description="Nome que identifica este tipo de atendimento"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Instalação de Ar Condicionado"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-800 text-base font-medium placeholder:text-zinc-400 outline-none focus:border-primary/40 transition-colors"
          />
        </section>

        {/* ── Section 2: Triggers ── */}
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader
            icon={Zap}
            title="Gatilhos de Ativação"
            description="Palavras ou frases que ativam este script automaticamente"
            badge={`${triggers.length} gatilho${triggers.length !== 1 ? "s" : ""}`}
          />

          <div className="mb-4 p-3.5 bg-accent/60 border border-primary/15 rounded-xl">
            <p className="text-xs text-zinc-600 leading-relaxed flex items-start gap-2">
              <Sparkles
                size={14}
                className="text-primary mt-0.5 flex-shrink-0"
              />
              Quando o cliente enviar uma mensagem contendo qualquer uma dessas
              palavras, a IA entrará automaticamente neste script de
              atendimento.
            </p>
          </div>

          <TagInput
            label="Palavras-chave"
            placeholder='Ex: instalar ar, instalação, ar condicionado'
            values={triggers}
            onChange={setTriggers}
            helperText="Pressione Enter ou vírgula para adicionar"
          />
        </section>

        {/* ── Section 3: Steps/Phases ── */}
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader
            icon={ClipboardList}
            title="Roteiro de Atendimento"
            description="Passos que a IA deve seguir durante o atendimento"
            badge={`${phases.length} passo${phases.length !== 1 ? "s" : ""}`}
          />

          {phases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-3">
                <MessageSquare size={22} className="text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-zinc-500 mb-1">
                Nenhum passo adicionado
              </p>
              <p className="text-xs text-zinc-400 max-w-[280px] mb-5">
                Adicione passos para criar o roteiro que a IA vai seguir durante
                o atendimento
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 mb-4">
              {phases.map((phase, i) => (
                <div key={phase.id} className="relative">
                  {i > 0 && (
                    <div className="absolute -top-1.5 left-[34px] w-px h-1.5 bg-zinc-100" />
                  )}
                  <StepCard
                    phase={phase}
                    index={i}
                    total={phases.length}
                    onChange={(updated) => updatePhase(i, updated)}
                    onDelete={() => deletePhase(i)}
                    onMoveUp={() => movePhase(i, i - 1)}
                    onMoveDown={() => movePhase(i, i + 1)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add step buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => addPhase("question")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-blue-200 bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-all"
            >
              <Plus size={13} /> Pergunta
            </button>
            <button
              onClick={() => addPhase("action")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 text-amber-600 text-xs font-medium hover:bg-amber-100 transition-all"
            >
              <Plus size={13} /> Ação
            </button>
            <button
              onClick={() => addPhase("trigger")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-primary/25 bg-accent text-primary text-xs font-medium hover:bg-primary/15 transition-all"
            >
              <Plus size={13} /> Gatilho
            </button>
            <button
              onClick={() => addPhase("output")}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-primary/25 bg-accent text-primary text-xs font-medium hover:bg-primary/15 transition-all"
            >
              <Plus size={13} /> Saída
            </button>
          </div>
          <div ref={stepsEndRef} />
        </section>

        {/* ── Section 4: Required Data ── */}
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader
            icon={CheckCheck}
            title="Dados Obrigatórios"
            description="Informações que a IA precisa coletar antes de concluir o atendimento"
          />
          <TagInput
            label="Dados a coletar"
            placeholder='Ex: tipo do equipamento, quantidade de BTUs, bairro'
            values={requiredData}
            onChange={setRequiredData}
            helperText="A IA não finalizará até coletar todos estes dados"
          />
        </section>

        {/* ── Section 5: Custom Instructions ── */}
        <section className="bg-white border border-zinc-200 rounded-xl p-5">
          <SectionHeader
            icon={Sparkles}
            title="Instruções Adicionais"
            description="Instruções extras que têm prioridade máxima neste script"
          />
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={5}
            placeholder="Ex: Sempre ofereça desconto para pacotes de 2 ou mais aparelhos. O valor da visita técnica é R$ 290,00 e pode ser abatido no orçamento final..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-primary/40 resize-none transition-colors leading-relaxed"
          />
          <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
            <Info size={10} />
            Estas instruções são adicionadas ao roteiro e guiam o comportamento
            da IA durante o script
          </p>
        </section>
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
  const [selectedScript, setSelectedScript] =
    useState<IntentScriptData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredScripts = scripts.filter((s) =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      await intentScriptsApi.updateScript(script.id, {
        enabled: !script.enabled,
      });
      setScripts((prev) =>
        prev.map((s) =>
          s.id === script.id ? { ...s, enabled: !s.enabled } : s
        )
      );
      toast.success(
        script.enabled ? "Script desativado" : "Script ativado"
      );
    } catch {
      toast.error("Erro ao atualizar script");
    }
  };

  const handleDuplicate = async (script: IntentScriptData) => {
    try {
      const res = await intentScriptsApi.createScript({
        label: `${script.label} (cópia)`,
        triggers: [...script.triggers],
        requiredData: [...script.requiredData],
        phases: script.phases.map((p) => ({
          ...p,
          id: `phase_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        })),
        customInstructions: script.customInstructions,
      });
      setScripts((prev) => [...prev, res.data]);
      toast.success("Script duplicado!");
    } catch {
      toast.error("Erro ao duplicar script");
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
        const res = await intentScriptsApi.updateScript(
          selectedScript.id,
          data
        );
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
    if (
      !confirm(
        `Tem certeza que deseja excluir o script "${selectedScript.label}"?`
      )
    )
      return;

    setIsSaving(true);
    try {
      await intentScriptsApi.deleteScript(selectedScript.id);
      setScripts((prev) =>
        prev.filter((s) => s.id !== selectedScript.id)
      );
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

  const activeCount = scripts.filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {view === "list" ? (
          <>
            {/* Page header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-accent border border-primary/20 flex items-center justify-center">
                    <Bot size={18} className="text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-zinc-800">
                      Scripts de Atendimento
                    </h1>
                    <p className="text-xs text-zinc-500">
                      {scripts.length}{" "}
                      {scripts.length === 1 ? "script" : "scripts"} •{" "}
                      {activeCount}{" "}
                      {activeCount === 1 ? "ativo" : "ativos"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all shadow-md shadow-primary/20"
              >
                <Plus size={16} />
                Novo Script
              </button>
            </div>

            {/* Info banner */}
            <div className="mb-5 p-4 bg-accent/60 border border-primary/15 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <HelpCircle size={14} className="text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-zinc-700 mb-1">
                    Como funciona?
                  </p>
                  <p className="text-zinc-500 leading-relaxed text-xs">
                    Quando um cliente mencionar palavras-chave configuradas
                    em um script, a IA entra automaticamente no roteiro de
                    atendimento, seguindo os passos e coletando as
                    informações necessárias. O script se encerra quando o
                    cliente muda de assunto ou cancela.
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            {scripts.length > 2 && (
              <div className="mb-4 relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar scripts..."
                  className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-primary/30 transition-colors"
                />
              </div>
            )}

            {/* Script list */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-primary/50" />
              </div>
            ) : filteredScripts.length === 0 && searchQuery ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={28} className="text-zinc-300 mb-3" />
                <p className="text-sm text-zinc-500">
                  Nenhum script encontrado para &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            ) : scripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-2xl bg-accent border border-primary/15 flex items-center justify-center mb-5">
                  <MessageSquare size={32} className="text-primary/50" />
                </div>
                <h3 className="text-base font-semibold text-zinc-700 mb-1.5">
                  Nenhum script criado
                </h3>
                <p className="text-sm text-zinc-400 max-w-[320px] mb-6 leading-relaxed">
                  Crie seu primeiro script para que a IA siga um roteiro
                  estruturado quando detectar uma intenção específica do
                  cliente.
                </p>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-all shadow-md shadow-primary/20"
                >
                  <Plus size={16} />
                  Criar primeiro script
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredScripts.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onSelect={() => handleSelectScript(script)}
                    onToggle={() => handleToggleEnabled(script)}
                    onDuplicate={() => handleDuplicate(script)}
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
