"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Check, Bot, User, Users, AlertCircle, ArrowDownUp, Smartphone, PlusCircle, MinusCircle } from "lucide-react";
import { tagApi, Tag } from "@/lib/tag";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineStage } from "@/types/pipeline";
import { useAuthStore } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils";
import { WhatsAppInstance } from "@/types/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AdvancedFilters {
  excludeGroups: boolean;
  selectedTags: string[];
  tagFilterMode: "include" | "exclude";
  onlyNeedsHelp: boolean;
  onlyAiEnabled: boolean;
  onlyHumanEnabled: boolean;
  selectedInstanceId: string | null;
  selectedStageIds: string[];
  stageFilterMode: "include" | "exclude";
}

interface AdvancedFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  instances: WhatsAppInstance[];
  sortType?: string;
  onSortChange?: (value: string) => void;
}

export function AdvancedFilters({ filters, onFiltersChange, instances, sortType, onSortChange }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!open) return;

    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const allTags = await tagApi.getAll();
        const hasAutoTag = allTags.some(t => t.name.toLowerCase() === 'automação');
        if (!hasAutoTag) {
          allTags.push({ id: 'sys-automacao', name: 'automação', color: '#8b5cf6', companyId: '' } as Tag);
        }
        setTags(allTags);
      } catch (error) {
        console.error("Error loading tags:", error);
      } finally {
        setLoadingTags(false);
      }
    };

    const loadStages = async () => {
      if (!user?.companyId) return;
      try {
        setLoadingStages(true);
        const allStages = await pipelineApi.getStages(user.companyId);
        setStages(allStages);
      } catch (error) {
        console.error("Error loading stages:", error);
      } finally {
        setLoadingStages(false);
      }
    };

    loadTags();
    loadStages();
  }, [open, user?.companyId]);

  const activeCount =
    (filters.excludeGroups ? 1 : 0) +
    filters.selectedTags.length +
    (filters.selectedInstanceId ? 1 : 0) +
    filters.selectedStageIds.length +
    (filters.onlyNeedsHelp ? 1 : 0) +
    (filters.onlyAiEnabled ? 1 : 0) +
    (filters.onlyHumanEnabled ? 1 : 0);

  const hasActiveFilters = activeCount > 0;

  const update = (partial: Partial<AdvancedFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  const handleClearFilters = () =>
    onFiltersChange({
      excludeGroups: false,
      selectedTags: [],
      tagFilterMode: "include",
      onlyNeedsHelp: false,
      onlyAiEnabled: false,
      onlyHumanEnabled: false,
      selectedInstanceId: null,
      selectedStageIds: [],
      stageFilterMode: "include",
    });

  const handleToggleTag = (tagName: string) => {
    const isSelected = filters.selectedTags.includes(tagName);
    update({
      selectedTags: isSelected
        ? filters.selectedTags.filter(t => t !== tagName)
        : [...filters.selectedTags, tagName],
    });
  };

  const handleToggleStage = (stageId: string) => {
    const isSelected = filters.selectedStageIds.includes(stageId);
    update({
      selectedStageIds: isSelected
        ? filters.selectedStageIds.filter(id => id !== stageId)
        : [...filters.selectedStageIds, stageId],
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          className="h-9 relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge
              variant="secondary"
              className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-white text-primary text-[10px]"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0" align="start">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Filtros</span>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar tudo
            </button>
          )}
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Instância + Ordenação lado a lado */}
          <div className={cn("gap-3", instances.length > 1 && sortType ? "grid grid-cols-2" : "flex")}>
            {instances.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> Número
                </p>
                <Select
                  value={filters.selectedInstanceId || "all"}
                  onValueChange={(v) => update({ selectedInstanceId: v === "all" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.displayName || inst.instanceName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sortType && onSortChange && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <ArrowDownUp className="h-3 w-3" /> Ordenar
                </p>
                <Select value={sortType} onValueChange={onSortChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Mais recentes</SelectItem>
                    <SelectItem value="oldest">Mais antigas</SelectItem>
                    <SelectItem value="name">Nome (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Status — chips compactos em grid */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "onlyNeedsHelp", label: "Precisa de ajuda", icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-amber-600", activeBg: "bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700" },
                  { key: "onlyAiEnabled", label: "Apenas IA", icon: <Bot className="h-3.5 w-3.5" />, color: "text-blue-600", activeBg: "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700" },
                  { key: "onlyHumanEnabled", label: "Apenas humano", icon: <User className="h-3.5 w-3.5" />, color: "text-green-600", activeBg: "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700" },
                  { key: "excludeGroups", label: "Ocultar grupos", icon: <Users className="h-3.5 w-3.5" />, color: "text-purple-600", activeBg: "bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700" },
                ] as const
              ).map(({ key, label, icon, color, activeBg }) => {
                const isActive = filters[key] as boolean;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === "onlyAiEnabled") {
                        update({ onlyAiEnabled: !filters.onlyAiEnabled, onlyHumanEnabled: !filters.onlyAiEnabled ? false : filters.onlyHumanEnabled });
                      } else if (key === "onlyHumanEnabled") {
                        update({ onlyHumanEnabled: !filters.onlyHumanEnabled, onlyAiEnabled: !filters.onlyHumanEnabled ? false : filters.onlyAiEnabled });
                      } else {
                        update({ [key]: !filters[key] });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                      isActive ? cn(activeBg, color) : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span className={cn(isActive ? color : "text-muted-foreground")}>{icon}</span>
                    <span className="flex-1 leading-tight">{label}</span>
                    {isActive && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tags</p>
              {filters.selectedTags.length > 0 && (
                <ModeToggle
                  mode={filters.tagFilterMode}
                  onChange={(m) => update({ tagFilterMode: m })}
                />
              )}
            </div>

            {loadingTags ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Carregando...</p>
            ) : tags.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma tag cadastrada</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isSelected = filters.selectedTags.includes(tag.name);
                  const color = tag.color || "#8b5cf6";
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border hover:scale-105"
                      style={isSelected ? {
                        backgroundColor: filters.tagFilterMode === "exclude" ? `${color}20` : color,
                        borderColor: color,
                        color: filters.tagFilterMode === "exclude" ? color : "#fff",
                        textDecoration: filters.tagFilterMode === "exclude" ? "line-through" : "none",
                      } : {
                        backgroundColor: `${color}12`,
                        borderColor: `${color}50`,
                        color: color,
                      }}
                    >
                      {filters.tagFilterMode === "exclude" && isSelected
                        ? <MinusCircle className="h-2.5 w-2.5" />
                        : isSelected
                        ? <Check className="h-2.5 w-2.5" />
                        : null}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Estágios */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Estágio do funil</p>
              {filters.selectedStageIds.length > 0 && (
                <ModeToggle
                  mode={filters.stageFilterMode}
                  onChange={(m) => update({ stageFilterMode: m })}
                />
              )}
            </div>

            {loadingStages ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Carregando...</p>
            ) : stages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">Nenhum estágio cadastrado</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stages.map((stage) => {
                  const isSelected = filters.selectedStageIds.includes(stage.id);
                  const color = stage.color || "#6b7280";
                  return (
                    <button
                      key={stage.id}
                      onClick={() => handleToggleStage(stage.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border hover:scale-105"
                      style={isSelected ? {
                        backgroundColor: filters.stageFilterMode === "exclude" ? `${color}18` : `${color}25`,
                        borderColor: color,
                        color: color,
                        textDecoration: filters.stageFilterMode === "exclude" ? "line-through" : "none",
                      } : {
                        backgroundColor: "transparent",
                        borderColor: `${color}60`,
                        color: color,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color, opacity: filters.stageFilterMode === "exclude" && isSelected ? 0.5 : 1 }}
                      />
                      {filters.stageFilterMode === "exclude" && isSelected
                        ? <MinusCircle className="h-2.5 w-2.5" />
                        : isSelected
                        ? <Check className="h-2.5 w-2.5" />
                        : null}
                      {stage.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModeToggle({ mode, onChange }: { mode: "include" | "exclude"; onChange: (m: "include" | "exclude") => void }) {
  return (
    <div className="flex items-center rounded-md border overflow-hidden text-[10px] font-semibold">
      <button
        onClick={() => onChange("include")}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 transition-colors",
          mode === "include"
            ? "bg-green-500 text-white"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        <PlusCircle className="h-2.5 w-2.5" />
        Incluir
      </button>
      <button
        onClick={() => onChange("exclude")}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 transition-colors",
          mode === "exclude"
            ? "bg-red-500 text-white"
            : "text-muted-foreground hover:bg-muted"
        )}
      >
        <MinusCircle className="h-2.5 w-2.5" />
        Excluir
      </button>
    </div>
  );
}
