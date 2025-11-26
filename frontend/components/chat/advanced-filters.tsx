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

export interface AdvancedFilters {
  excludeGroups: boolean;
  selectedTags: string[];
}

interface AdvancedFiltersProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
}

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Carrega as tags disponíveis
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const allTags = await tagApi.getAll();
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
  const hasActiveFilters = filters.excludeGroups || filters.selectedTags.length > 0;

  const handleToggleGroup = () => {
    onFiltersChange({
      ...filters,
      excludeGroups: !filters.excludeGroups,
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
              {(filters.excludeGroups ? 1 : 0) + filters.selectedTags.length}
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
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleToggleTag(tag.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                          "border hover:scale-105",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-accent"
                        )}
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

          {/* Resumo dos filtros ativos */}
          {hasActiveFilters && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Filtros ativos:</p>
              <div className="flex flex-wrap gap-1.5">
                {filters.excludeGroups && (
                  <Badge variant="secondary" className="text-xs">
                    Sem grupos
                  </Badge>
                )}
                {filters.selectedTags.map((tagName) => (
                  <Badge key={tagName} variant="secondary" className="text-xs">
                    {tagName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
