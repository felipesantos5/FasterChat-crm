"use client";

import { useState, useEffect, useMemo } from "react";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineBoard, PipelineStage } from "@/types/pipeline";
import { Customer } from "@/types/customer";
import { Tag, tagApi } from "@/lib/tag";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManageStagesModal } from "@/components/pipeline/manage-stages-modal";
import { Settings2, GripVertical, Phone, Calendar, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createPortal } from "react-dom";
import { ptBR } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { PipelineSkeleton } from "@/components/ui/skeletons";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";

export default function PipelinePage() {
  return (
    <ProtectedPage requiredPage="PIPELINE">
      <PipelinePageContent />
    </ProtectedPage>
  );
}

function PipelinePageContent() {
  const router = useRouter();
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasError, handleError, clearError } = useErrorHandler();
  const [draggedCustomer, setDraggedCustomer] = useState<Customer | null>(null);
  const [draggedFromStage, setDraggedFromStage] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

  const [titlePortalNode, setTitlePortalNode] = useState<HTMLElement | null>(null);
  const [actionsPortalNode, setActionsPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTitlePortalNode(document.getElementById("header-title-portal"));
    setActionsPortalNode(document.getElementById("header-actions-portal"));
  }, []);

  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  const loadBoard = async () => {
    try {
      clearError();
      const cId = getCompanyId();
      setCompanyId(cId);

      if (!cId) {
        handleError("Empresa não encontrada");
        return;
      }

      // Carrega board e tags em paralelo
      const [data, tagsData] = await Promise.all([
        pipelineApi.getBoard(cId),
        tagApi.getAll().catch(() => [] as Tag[]),
      ]);

      setTags(tagsData);

      if (data.stages.length === 0) {
        await pipelineApi.initPipeline(cId);
        const newData = await pipelineApi.getBoard(cId);
        setBoard(newData);
      } else {
        setBoard(data);
      }
    } catch (err: any) {
      console.error("Error loading board:", err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, []);

  // Mapa de nome da tag → cor
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach((tag) => {
      if (tag.color) {
        map[tag.name] = tag.color;
      }
    });
    return map;
  }, [tags]);

  // Função para obter a cor de uma tag pelo nome
  const getTagColor = (tagName: string) => {
    return tagColorMap[tagName] || null;
  };

  // Calcula estatísticas do pipeline
  const stats = useMemo(() => {
    if (!board) return { totalLeads: 0, responseRate: 0 };

    const totalLeads = board.stages.reduce((acc, stage) => acc + stage.customers.length, board.customersWithoutStage.length);

    // Taxa de conversão: clientes no estágio "Fechado - Ganho" / total
    const wonStage = board.stages.find(
      (s) =>
        s.stage.name.toLowerCase().includes("ganho") ||
        (s.stage.name.toLowerCase().includes("fechado") && !s.stage.name.toLowerCase().includes("perdido"))
    );
    const wonCount = wonStage?.customers.length || 0;
    const responseRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

    // Taxa de perda: clientes no estágio "Fechado - Perdido" ou similar / total
    const lostStage = board.stages.find(
      (s) => s.stage.name.toLowerCase().includes("perdido")
    );
    const lostCount = lostStage?.customers.length || 0;
    const lossRate = totalLeads > 0 ? Math.round((lostCount / totalLeads) * 100) : 0;

    return { totalLeads, responseRate, lossRate };
  }, [board]);

  // Lista de stages para o modal
  const stagesList: PipelineStage[] = useMemo(() => {
    if (!board) return [];
    return board.stages.map((s) => s.stage);
  }, [board]);

  const handleDragStart = (customer: Customer, fromStageId: string | null) => {
    setDraggedCustomer(customer);
    setDraggedFromStage(fromStageId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string | null) => {
    e.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (toStageId: string | null) => {
    setDragOverStageId(null);
    if (!draggedCustomer || !board || isMoving) return;

    // Se está soltando no mesmo estágio, não faz nada
    if (draggedFromStage === toStageId) {
      setDraggedCustomer(null);
      setDraggedFromStage(null);
      return;
    }

    const cId = getCompanyId();
    if (!cId) return;

    // Guarda o estado anterior para rollback em caso de erro
    const previousBoard = board;
    const customerToMove = draggedCustomer;
    const fromStageId = draggedFromStage;

    // Optimistic update: atualiza a UI imediatamente
    setBoard((prevBoard) => {
      if (!prevBoard) return prevBoard;

      const newBoard = { ...prevBoard };

      // Remove o cliente do estágio de origem
      if (fromStageId === null) {
        // Estava em "sem estágio"
        newBoard.customersWithoutStage = prevBoard.customersWithoutStage.filter(
          (c) => c.id !== customerToMove.id
        );
      } else {
        // Estava em um estágio específico
        newBoard.stages = prevBoard.stages.map((stageData) => {
          if (stageData.stage.id === fromStageId) {
            return {
              ...stageData,
              customers: stageData.customers.filter((c) => c.id !== customerToMove.id),
            };
          }
          return stageData;
        });
      }

      // Adiciona o cliente no estágio de destino
      if (toStageId === null) {
        // Movendo para "sem estágio"
        newBoard.customersWithoutStage = [customerToMove, ...newBoard.customersWithoutStage];
      } else {
        // Movendo para um estágio específico
        newBoard.stages = newBoard.stages.map((stageData) => {
          if (stageData.stage.id === toStageId) {
            return {
              ...stageData,
              customers: [customerToMove, ...stageData.customers],
            };
          }
          return stageData;
        });
      }

      return newBoard;
    });

    // Limpa o estado de drag
    setDraggedCustomer(null);
    setDraggedFromStage(null);
    setIsMoving(true);

    // Faz a chamada ao backend em segundo plano
    try {
      await pipelineApi.moveCustomer(customerToMove.id, cId, {
        stageId: toStageId,
      });
      // Sucesso - não precisa fazer nada, UI já está atualizada
    } catch (err: any) {
      console.error("Error moving customer:", err);
      // Rollback: reverte para o estado anterior
      setBoard(previousBoard);
      toast.error("Erro ao mover cliente. A alteração foi revertida.");
    } finally {
      setIsMoving(false);
    }
  };

  const handleCustomerClick = (customer: Customer) => {
    router.push(`/dashboard/conversations?customer=${customer.id}`);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "-";

    // Remove tudo que não é número
    const numbers = phone.replace(/\D/g, "");

    // Formato brasileiro: +55 (11) 99999-9999
    if (numbers.length === 13 && numbers.startsWith("55")) {
      // Com código do país: 5511999999999
      const ddd = numbers.slice(2, 4);
      const part1 = numbers.slice(4, 9);
      const part2 = numbers.slice(9);
      return `(${ddd}) ${part1}-${part2}`;
    }

    if (numbers.length === 12 && numbers.startsWith("55")) {
      // Com código do país (fixo): 551199999999
      const ddd = numbers.slice(2, 4);
      const part1 = numbers.slice(4, 8);
      const part2 = numbers.slice(8);
      return `(${ddd}) ${part1}-${part2}`;
    }

    if (numbers.length === 11) {
      // Celular: 11999999999
      const ddd = numbers.slice(0, 2);
      const part1 = numbers.slice(2, 7);
      const part2 = numbers.slice(7);
      return `(${ddd}) ${part1}-${part2}`;
    }

    if (numbers.length === 10) {
      // Fixo: 1199999999
      const ddd = numbers.slice(0, 2);
      const part1 = numbers.slice(2, 6);
      const part2 = numbers.slice(6);
      return `(${ddd}) ${part1}-${part2}`;
    }

    // Se não se encaixar em nenhum formato, retorna como está
    return phone;
  };

  if (loading) {
    return <PipelineSkeleton />;
  }

  if (hasError) {
    return <LoadingErrorState resource="pipeline" onRetry={loadBoard} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden">
        {/* Renderiza as estatísticas e os botões no Header principal usando Portals */}
        {titlePortalNode && createPortal(
          <div className="flex items-center gap-4 sm:gap-6 ml-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50/50 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 leading-none mb-0.5">Total Leads</p>
                <p className="text-sm font-bold text-gray-900 leading-none">{stats.totalLeads}</p>
              </div>
            </div>

            <div className="hidden sm:block w-px h-6 bg-gray-200" />

            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-50/50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 leading-none mb-0.5">Conversão</p>
                <p className="text-sm font-bold text-green-600 leading-none">{stats.responseRate}%</p>
              </div>
            </div>

            <div className="hidden sm:block w-px h-6 bg-gray-200" />

            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-50/50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 leading-none mb-0.5">Perda</p>
                <p className="text-sm font-bold text-red-600 leading-none">{stats.lossRate}%</p>
              </div>
            </div>
          </div>,
          titlePortalNode
        )}

        {actionsPortalNode && createPortal(
          <Button
            onClick={() => setManageStagesOpen(true)}
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg"
          >
            <Settings2 className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Gerenciar Estágios</span>
          </Button>,
          actionsPortalNode
        )}

        {/* Kanban Board - Scroll Horizontal */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 overflow-y-hidden min-h-0">
          {board?.stages.map((stageData) => (
            <div
              key={stageData.stage.id}
              className={cn(
                "flex-shrink-0 w-72 h-full flex flex-col rounded-xl bg-white border shadow-sm transition-all overflow-hidden",
                dragOverStageId === stageData.stage.id ? "border-green-400 ring-2 ring-green-100" : "border-gray-200"
              )}
              onDragOver={(e) => handleDragOver(e, stageData.stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(stageData.stage.id)}
            >
              {/* Stage Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stageData.stage.color }} />
                    <span className="text-sm font-semibold text-gray-800">{stageData.stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
                    {stageData.customers.length}
                  </Badge>
                </div>
              </div>

              {/* Cards Container - Scroll Vertical Interno */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-0">
                {stageData.customers.map((customer) => (
                  <div
                    key={customer.id}
                    draggable
                    onDragStart={() => handleDragStart(customer, stageData.stage.id)}
                    onClick={() => handleCustomerClick(customer)}
                    className={cn(
                      "bg-gray-50 rounded-lg p-2.5 cursor-pointer border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group",
                      draggedCustomer?.id === customer.id && "opacity-50 scale-95"
                    )}
                  >
                    {/* Customer Name */}
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-bold text-xs text-gray-900 truncate flex-1">{customer.name}</p>
                      <GripVertical className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Phone */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 truncate">
                        <Phone className="h-2.5 w-2.5" />
                        <span className="truncate">{formatPhone(customer.phone)}</span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Calendar className="h-2.5 w-2.5" />
                        <span>{formatDate(customer.createdAt)}</span>
                      </div>
                    </div>

                    {/* Tags */}
                    {customer.tags && customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {customer.tags.slice(0, 2).map((tag) => {
                          const tagColor = getTagColor(tag);
                          return (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[9px] px-1 py-0 leading-tight h-4 border-0"
                              style={tagColor ? {
                                backgroundColor: tagColor,
                                color: '#fff',
                              } : {
                                backgroundColor: '#e5e7eb',
                                color: '#4b5563',
                              }}
                            >
                              {tag}
                            </Badge>
                          );
                        })}
                        {customer.tags.length > 2 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight h-4 bg-white border-gray-200 text-gray-600">
                            +{customer.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {stageData.customers.length === 0 && <div className="text-center py-8 text-gray-400 text-sm italic">Sem leads</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Gerenciamento de Estágios */}
      {companyId && (
        <ManageStagesModal
          open={manageStagesOpen}
          onOpenChange={setManageStagesOpen}
          companyId={companyId}
          stages={stagesList}
          onStagesUpdated={loadBoard}
        />
      )}
    </div>
  );
}
