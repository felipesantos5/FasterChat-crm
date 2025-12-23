"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineStage } from "@/types/pipeline";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManageStagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  stages: PipelineStage[];
  onStagesUpdated: () => void;
}

const PRESET_COLORS = [
  "#22C55E", // Green
  "#16A34A", // Green Dark
  "#4ADE80", // Green Light
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#94A3B8", // Slate
];

export function ManageStagesModal({
  open,
  onOpenChange,
  companyId,
  stages,
  onStagesUpdated,
}: ManageStagesModalProps) {
  const [localStages, setLocalStages] = useState<PipelineStage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalStages([...stages].sort((a, b) => a.order - b.order));
  }, [stages]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    dragNode.current = e.target as HTMLDivElement;

    // Adiciona classe de dragging após um pequeno delay para evitar flash
    setTimeout(() => {
      if (dragNode.current) {
        dragNode.current.classList.add("opacity-50");
      }
    }, 0);

    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Verifica se realmente saiu do elemento
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reordena localmente
    const newStages = [...localStages];
    const [draggedStage] = newStages.splice(draggedIndex, 1);
    newStages.splice(dropIndex, 0, draggedStage);

    // Atualiza ordem local
    const reorderedStages = newStages.map((stage, idx) => ({
      ...stage,
      order: idx,
    }));

    setLocalStages(reorderedStages);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Salva no backend
    setLoading(true);
    try {
      const stageIds = reorderedStages.map((s) => s.id);
      await pipelineApi.reorderStages(companyId, { stageIds });
      onStagesUpdated();
    } catch (error) {
      console.error("Erro ao reordenar estágios:", error);
      // Reverte em caso de erro
      setLocalStages([...stages].sort((a, b) => a.order - b.order));
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = () => {
    if (dragNode.current) {
      dragNode.current.classList.remove("opacity-50");
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragNode.current = null;
  };

  const handleStartEdit = (stage: PipelineStage) => {
    setEditingId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    setLoading(true);
    try {
      await pipelineApi.updateStage(editingId, companyId, {
        name: editName.trim(),
        color: editColor,
      });
      onStagesUpdated();
      handleCancelEdit();
    } catch (error) {
      console.error("Erro ao atualizar estágio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStage = async () => {
    if (!newName.trim()) return;

    setLoading(true);
    try {
      await pipelineApi.createStage(companyId, {
        name: newName.trim(),
        color: newColor,
      });
      onStagesUpdated();
      setIsAdding(false);
      setNewName("");
      setNewColor(PRESET_COLORS[0]);
    } catch (error) {
      console.error("Erro ao criar estágio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    setLoading(true);
    try {
      await pipelineApi.deleteStage(stageId, companyId);
      onStagesUpdated();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Erro ao deletar estágio:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Estágios do Pipeline</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-500 -mt-2">
          Arraste os estágios para reordenar
        </p>

        <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
          {localStages.map((stage, index) => (
            <div
              key={stage.id}
              draggable={editingId !== stage.id && deleteConfirmId !== stage.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-white transition-all",
                editingId === stage.id
                  ? "border-green-300 ring-2 ring-green-100"
                  : dragOverIndex === index
                    ? "border-green-400 border-2 bg-green-50"
                    : "border-gray-200 hover:border-gray-300",
                draggedIndex === index && "opacity-50"
              )}
            >
              {editingId === stage.id ? (
                // Modo de edição
                <div className="flex-1 space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome do estágio"
                    className="h-9"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500">Cor:</Label>
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 transition-all",
                            editColor === color
                              ? "border-gray-900 scale-110"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={loading || !editName.trim()}
                      className="h-8"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="ml-1">Salvar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={loading}
                      className="h-8"
                    >
                      <X className="h-4 w-4" />
                      <span className="ml-1">Cancelar</span>
                    </Button>
                  </div>
                </div>
              ) : deleteConfirmId === stage.id ? (
                // Confirmação de exclusão
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-700">
                    Excluir &quot;{stage.name}&quot;?
                  </p>
                  <p className="text-xs text-gray-500">
                    Os clientes deste estágio ficarão sem estágio.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteStage(stage.id)}
                      disabled={loading}
                      className="h-8"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirmId(null)}
                      disabled={loading}
                      className="h-8"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                // Modo de visualização
                <>
                  <GripVertical className="h-4 w-4 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0" />
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-gray-700 truncate">
                    {stage.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(stage)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(stage.id)}
                      className="h-8 w-8 p-0 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Adicionar novo estágio */}
          {isAdding ? (
            <div className="p-3 rounded-lg border border-green-300 bg-green-50/50 space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do novo estágio"
                className="h-9"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">Cor:</Label>
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        newColor === color
                          ? "border-gray-900 scale-110"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddStage}
                  disabled={loading || !newName.trim()}
                  className="h-8"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="ml-1">Adicionar</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setNewName("");
                    setNewColor(PRESET_COLORS[0]);
                  }}
                  disabled={loading}
                  className="h-8"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Estágio
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
