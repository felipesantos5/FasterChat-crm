"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X } from "lucide-react";
import { tagApi, Tag } from "@/lib/tag";
import { cn } from "@/lib/utils";
import { WhatsAppInstance } from "@/types/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone } from "lucide-react";

export interface AdvancedFilters {
  excludeGroups: boolean;
  selectedTags: string[];
  onlyNeedsHelp: boolean; // Mostra apenas conversas que precisam de ajuda
  onlyAiEnabled: boolean; // Mostra apenas conversas com IA ativa
  selectedInstanceId: string | null; // Filtro por instância do WhatsApp
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

    if (open) {
      loadTags();
    }
  }, [open]);

  // Verifica se há filtros ativos
  const hasActiveFilters = filters.excludeGroups || filters.selectedTags.length > 0 || filters.onlyNeedsHelp || filters.onlyAiEnabled || filters.selectedInstanceId !== null;

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

  const handleClearFilters = () => {
    onFiltersChange({
      excludeGroups: false,
      selectedTags: [],
      onlyNeedsHelp: false,
      onlyAiEnabled: false,
      selectedInstanceId: null,
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
              {(filters.excludeGroups ? 1 : 0) + filters.selectedTags.length + (filters.selectedInstanceId ? 1 : 0)}
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
          {instances.length > 0 && (
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
                <Label htmlFor="only-ai-enabled" className="text-sm font-medium cursor-pointer">
                  IA ativa
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
                          color: "#fff", // Sempre branco quando selecionado para contraste
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
