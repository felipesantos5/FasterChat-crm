"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { tagApi, Tag } from "@/lib/tag";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineStage } from "@/types/pipeline";
import { useAuthStore } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils";
import { WhatsAppInstance } from "@/types/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Bot, User } from "lucide-react";

export interface AdvancedFilters {
  excludeGroups: boolean;
  selectedTags: string[];
  onlyNeedsHelp: boolean; // Mostra apenas conversas que precisam de ajuda
  onlyAiEnabled: boolean; // Mostra apenas conversas com IA ativa
  onlyHumanEnabled: boolean; // Mostra apenas conversas humanas (sem IA)
  selectedInstanceId: string | null; // Filtro por instância do WhatsApp
  selectedStageIds: string[]; // Filtro por estágio do funil
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

  // Carrega as tags disponíveis
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const allTags = await tagApi.getAll();

        // Garante que a tag "automação" adicionada pelo fluxo de forma automática esteja sempre disponível para filtro
        const hasAutoTag = allTags.some(t => t.name.toLowerCase() === 'automação');
        if (!hasAutoTag) {
          allTags.push({ id: 'sys-automacao', name: 'automação', color: '#8b5cf6', companyId: '' } as any);
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

    if (open) {
      loadTags();
      loadStages();
    }
  }, [open]);

  // Verifica se há filtros ativos
  const hasActiveFilters = filters.excludeGroups || filters.selectedTags.length > 0 || filters.onlyNeedsHelp || filters.onlyAiEnabled || filters.onlyHumanEnabled || filters.selectedInstanceId !== null || filters.selectedStageIds.length > 0;

  const handleToggleGroup = () => {
    onFiltersChange({
      ...filters,
      excludeGroups: !filters.excludeGroups,
    });
  };

  const handleToggleNeedsHelp = () => {
    onFiltersChange({
      ...filters,
      onlyNeedsHelp: !filters.onlyNeedsHelp,
    });
  };

  const handleToggleAiEnabled = () => {
    onFiltersChange({
      ...filters,
      onlyAiEnabled: !filters.onlyAiEnabled,
      onlyHumanEnabled: !filters.onlyAiEnabled ? false : filters.onlyHumanEnabled, // Desliga o outro
    });
  };

  const handleToggleHumanEnabled = () => {
    onFiltersChange({
      ...filters,
      onlyHumanEnabled: !filters.onlyHumanEnabled,
      onlyAiEnabled: !filters.onlyHumanEnabled ? false : filters.onlyAiEnabled, // Desliga o outro
    });
  };

  const handleInstanceChange = (instanceId: string) => {
    onFiltersChange({
      ...filters,
      selectedInstanceId: instanceId === "all" ? null : instanceId,
    });
  };

  const handleToggleTag = (tagName: string) => {
    const isSelected = filters.selectedTags.includes(tagName);
    const newTags = isSelected
      ? filters.selectedTags.filter((t) => t !== tagName)
      : [...filters.selectedTags, tagName];

    onFiltersChange({
      ...filters,
      selectedTags: newTags,
    });
  };

  const handleToggleStage = (stageId: string) => {
    const isSelected = filters.selectedStageIds.includes(stageId);
    const newStageIds = isSelected
      ? filters.selectedStageIds.filter((id) => id !== stageId)
      : [...filters.selectedStageIds, stageId];

    onFiltersChange({
      ...filters,
      selectedStageIds: newStageIds,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      excludeGroups: false,
      selectedTags: [],
      onlyNeedsHelp: false,
      onlyAiEnabled: false,
      onlyHumanEnabled: false,
      selectedInstanceId: null,
      selectedStageIds: [],
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-9 relative",
            hasActiveFilters && "pr-8"
          )}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-white text-primary"
            >
              {(filters.excludeGroups ? 1 : 0) + filters.selectedTags.length + (filters.selectedInstanceId ? 1 : 0) + filters.selectedStageIds.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Filtros Avançados</h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 text-xs"
              >
                Limpar tudo
              </Button>
            )}
          </div>

          {/* Filtro de Instância */}
          {instances.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                NÚMEROS DO WHATSAPP
              </Label>
              <Select
                value={filters.selectedInstanceId || "all"}
                onValueChange={handleInstanceChange}
              >
                <SelectTrigger className="h-9 text-sm">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Todos os números" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os números</SelectItem>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.displayName || instance.instanceName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Ordenação */}
          {sortType && onSortChange && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                ORDENAÇÃO
              </Label>
              <Select value={sortType} onValueChange={onSortChange}>
                <SelectTrigger className="h-9 text-sm">
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

          {/* Filtros de Status */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              STATUS DA CONVERSA
            </Label>

            {/* Apenas conversas que precisam de ajuda */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
              <div className="space-y-0.5">
                <Label htmlFor="only-needs-help" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  🚨 Precisa de ajuda
                </Label>
                <p className="text-xs text-muted-foreground">
                  Conversas transferidas para humano
                </p>
              </div>
              <Switch
                id="only-needs-help"
                checked={filters.onlyNeedsHelp}
                onCheckedChange={handleToggleNeedsHelp}
              />
            </div>

            {/* Apenas conversas com IA ativa */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="only-ai-enabled" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Apenas IA
                </Label>
                <p className="text-xs text-muted-foreground">
                  Conversas sendo atendidas pela IA
                </p>
              </div>
              <Switch
                id="only-ai-enabled"
                checked={filters.onlyAiEnabled}
                onCheckedChange={handleToggleAiEnabled}
              />
            </div>

            {/* Apenas conversas Humanas */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="only-human-enabled" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Apenas Humano
                </Label>
                <p className="text-xs text-muted-foreground">
                  Conversas com a IA desativada
                </p>
              </div>
              <Switch
                id="only-human-enabled"
                checked={filters.onlyHumanEnabled}
                onCheckedChange={handleToggleHumanEnabled}
              />
            </div>
          </div>

          {/* Filtro de Grupos */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              TIPO DE CONVERSA
            </Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="exclude-groups" className="text-sm font-medium cursor-pointer">
                  Ocultar grupos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mostra apenas conversas individuais
                </p>
              </div>
              <Switch
                id="exclude-groups"
                checked={filters.excludeGroups}
                onCheckedChange={handleToggleGroup}
              />
            </div>
          </div>

          {/* Filtro de Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              FILTRAR POR TAGS
            </Label>
            <div className="space-y-2">
              {loadingTags ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Carregando tags...
                </div>
              ) : tags.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma tag cadastrada
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-1">
                  {tags.map((tag) => {
                    const isSelected = filters.selectedTags.includes(tag.name);
                    const tagColor = tag.color || "#e5e7eb";

                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                          "border hover:scale-105"
                        )}
                        style={isSelected ? {
                          backgroundColor: tagColor,
                          borderColor: tagColor,
                          color: "#fff",
                          boxShadow: `0 0 0 1px ${tagColor}40`
                        } : {
                          backgroundColor: `${tagColor}10`,
                          borderColor: `${tagColor}40` || "#e5e7eb",
                          color: tagColor || "inherit"
                        }}
                      >
                        {tag.name}
                        {isSelected && <X className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Filtro de Estágio do Funil */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              FILTRAR POR ESTÁGIO
            </Label>
            <div className="space-y-1">
              {loadingStages ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Carregando estágios...
                </div>
              ) : stages.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Nenhum estágio cadastrado
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                  {stages.map((stage) => {
                    const isSelected = filters.selectedStageIds.includes(stage.id);
                    return (
                      <button
                        key={stage.id}
                        onClick={() => handleToggleStage(stage.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all text-left",
                          "border hover:bg-muted/50",
                          isSelected && "bg-muted"
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="flex-1 truncate">{stage.name}</span>
                        {isSelected && <X className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
