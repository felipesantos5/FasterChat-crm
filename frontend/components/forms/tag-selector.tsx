'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getTagColor } from '@/lib/constants/tags';
import { cn } from '@/lib/utils';
import { tagApi } from '@/lib/tag';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[];
  placeholder?: string;
  disabled?: boolean;
  onTagCreated?: (tagName: string) => void; // Callback quando tag é criada
}

export function TagSelector({
  value = [],
  onChange,
  availableTags = [],
  placeholder = 'Adicionar tags...',
  disabled = false,
  onTagCreated,
}: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagValue, setNewTagValue] = useState('');
  const [creating, setCreating] = useState(false);

  const addTag = async (tag: string, createInDatabase = false) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !value.includes(trimmedTag)) {
      // Se for uma tag nova e não estiver na lista de disponíveis, criar no banco
      if (createInDatabase && !availableTags.includes(trimmedTag)) {
        try {
          setCreating(true);
          console.log('[TagSelector] Creating tag in database:', trimmedTag);
          await tagApi.create(trimmedTag);
          console.log('[TagSelector] Tag created successfully');
          onTagCreated?.(trimmedTag);
        } catch (error) {
          console.error('[TagSelector] Error creating tag:', error);
        } finally {
          setCreating(false);
        }
      }

      onChange([...value, trimmedTag]);
      setSearchValue('');
      setNewTagValue('');
      setShowNewTagInput(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const toggleTag = (tag: string) => {
    if (value.includes(tag)) {
      removeTag(tag);
    } else {
      addTag(tag);
    }
  };

  const handleAddNewTag = () => {
    if (newTagValue.trim()) {
      addTag(newTagValue, true); // true = criar no banco de dados
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    }
  };

  // Filtra tags disponíveis que ainda não foram selecionadas
  const unselectedTags = availableTags.filter((tag) => !value.includes(tag));

  // Filtra tags baseado na busca
  const filteredTags = searchValue
    ? unselectedTags.filter((tag) =>
        tag.toLowerCase().includes(searchValue.toLowerCase())
      )
    : unselectedTags;

  return (
    <div className="space-y-3">
      {/* Tags Selecionadas */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              className={cn('gap-1 border', getTagColor(tag))}
              variant="outline"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Popover de Seleção */}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {placeholder}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Buscar ou adicionar tag..."
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                {/* Tags Existentes */}
                {filteredTags.length > 0 && (
                  <CommandGroup heading="Tags Existentes">
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => {
                          toggleTag(tag);
                          setSearchValue('');
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={cn(
                              'h-4 w-4 border rounded-sm flex items-center justify-center',
                              value.includes(tag) && 'bg-primary border-primary'
                            )}
                          >
                            {value.includes(tag) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <Badge
                            className={cn('border', getTagColor(tag))}
                            variant="outline"
                          >
                            {tag}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Opção de criar nova tag */}
                {searchValue && !availableTags.includes(searchValue) && (
                  <CommandGroup heading="Nova Tag">
                    <CommandItem
                      value={`create-${searchValue}`}
                      onSelect={() => {
                        addTag(searchValue, true); // true = criar no banco de dados
                        setOpen(false);
                      }}
                      disabled={creating}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {creating ? 'Criando...' : `Criar tag "${searchValue}"`}
                    </CommandItem>
                  </CommandGroup>
                )}

                {/* Caso não encontre nada */}
                {filteredTags.length === 0 && !searchValue && (
                  <CommandEmpty>
                    {availableTags.length === 0
                      ? 'Nenhuma tag cadastrada ainda.'
                      : 'Todas as tags já foram selecionadas.'}
                  </CommandEmpty>
                )}
              </CommandList>

              {/* Input Manual para Nova Tag */}
              <div className="border-t p-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Digite uma nova tag..."
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1"
                      disabled={creating}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewTag}
                      disabled={!newTagValue.trim() || creating}
                    >
                      {creating ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {creating ? 'Criando tag...' : 'Digite e pressione Enter ou clique em + para adicionar'}
                  </p>
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
