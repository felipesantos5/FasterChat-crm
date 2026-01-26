'use client';

import { useState } from 'react';
import { X, Plus, ChevronDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { tagApi, Tag } from '@/lib/tag';
import { ColorPicker } from '@/components/ui/color-picker';
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
  availableTags?: Tag[];
  placeholder?: string;
  disabled?: boolean;
  onTagCreated?: (tag: Tag) => void; // Callback quando tag é criada
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
  const [newTagValue, setNewTagValue] = useState('');
  const [newTagColor, setNewTagColor] = useState('#22C55E');
  const [creating, setCreating] = useState(false);
  // Mapa local de cores para tags criadas na sessão (resolve o problema de cor verde)
  const [localTagColors, setLocalTagColors] = useState<Record<string, string>>({});

  const addTag = async (tag: string, createInDatabase = false, color?: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !value.includes(trimmedTag)) {
      // Se for uma tag nova e não estiver na lista de disponíveis, criar no banco
      const tagExists = availableTags.some((t) => t.name === trimmedTag);
      const tagColor = color || newTagColor;

      if (createInDatabase && !tagExists) {
        try {
          setCreating(true);
          const createdTag = await tagApi.create(trimmedTag, tagColor);
          // Salva a cor localmente para exibição imediata
          setLocalTagColors(prev => ({ ...prev, [trimmedTag]: createdTag.color || tagColor }));
          onTagCreated?.(createdTag);
        } catch (error) {
          console.error('[TagSelector] Error creating tag:', error);
        } finally {
          setCreating(false);
        }
      }

      onChange([...value, trimmedTag]);
      setSearchValue('');
      setNewTagValue('');
      setNewTagColor('#22C55E');
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
      addTag(newTagValue, true, newTagColor); // Passa a cor selecionada no ColorPicker
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    }
  };

  // Filtra tags disponíveis que ainda não foram selecionadas
  const unselectedTags = availableTags.filter((tag) => !value.includes(tag.name));

  // Filtra tags baseado na busca
  const filteredTags = searchValue
    ? unselectedTags.filter((tag) =>
      tag.name.toLowerCase().includes(searchValue.toLowerCase())
    )
    : unselectedTags;

  // Retorna a cor da tag pelo nome (verifica primeiro no mapa local, depois no availableTags)
  const getTagColorByName = (tagName: string): string => {
    // Primeiro verifica se a cor foi salva localmente (tags criadas na sessão)
    if (localTagColors[tagName]) {
      return localTagColors[tagName];
    }
    // Depois busca no availableTags
    const tag = availableTags.find((t) => t.name === tagName);
    return tag?.color || '#22C55E';
  };

  return (
    <div className="space-y-3">
      {/* Tags Selecionadas */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => {
            const tagColor = getTagColorByName(tag);
            return (
              <Badge
                key={tag}
                className={cn('gap-1 border text-white')}
                variant="outline"
                style={{
                  backgroundColor: tagColor,
                  borderColor: tagColor,
                }}
              >
                {tag}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:bg-black/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
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
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            sideOffset={4}
            style={{ maxHeight: '350px' }}
          >
            <Command className="flex flex-col max-h-[350px]">
              <CommandInput
                placeholder="Buscar ou adicionar tag..."
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList className="max-h-[180px] overflow-y-auto">
                {/* Tags Existentes */}
                {filteredTags.length > 0 && (
                  <CommandGroup heading="Tags Existentes">
                    {filteredTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        value={tag.name}
                        onSelect={() => {
                          toggleTag(tag.name);
                          setSearchValue('');
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={cn(
                              'h-4 w-4 border rounded-sm flex items-center justify-center',
                              value.includes(tag.name) && 'bg-primary border-primary'
                            )}
                          >
                            {value.includes(tag.name) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <Badge
                            className={cn('border text-white')}
                            variant="outline"
                            style={{
                              backgroundColor: tag.color || '#22C55E',
                              borderColor: tag.color || '#22C55E',
                            }}
                          >
                            {tag.name}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {/* Opção de criar nova tag */}
                {searchValue && !availableTags.some((t) => t.name === searchValue) && (
                  <CommandGroup heading="Nova Tag">
                    <CommandItem
                      value={`create-${searchValue}`}
                      onSelect={() => {
                        addTag(searchValue, true, newTagColor); // Passa a cor selecionada
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
              <div className="border-t p-3 flex-shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Digite uma nova tag..."
                      value={newTagValue}
                      onChange={(e) => setNewTagValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 h-8 text-sm"
                      disabled={creating}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddNewTag}
                      disabled={!newTagValue.trim() || creating}
                      className="h-8 w-8 p-0"
                    >
                      {creating ? (
                        <span className="animate-spin text-xs">⏳</span>
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {newTagValue.trim() && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-700">
                        Escolha uma cor:
                      </p>
                      <ColorPicker
                        value={newTagColor}
                        onChange={setNewTagColor}
                        disabled={creating}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
