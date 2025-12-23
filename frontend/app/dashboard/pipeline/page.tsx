"use client";

import { useState, useEffect, useMemo } from "react";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineBoard, PipelineStage } from "@/types/pipeline";
import { Customer } from "@/types/customer";
import { Tag, tagApi } from "@/lib/tag";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ManageStagesModal } from "@/components/pipeline/manage-stages-modal";
import { Loader2, Settings2, GripVertical, Phone, Calendar, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { spacing } from "@/lib/design-system";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PipelinePage() {
  const router = useRouter();
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedCustomer, setDraggedCustomer] = useState<Customer | null>(null);
  const [, setDraggedFromStage] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);

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
      setError(null);
      const cId = getCompanyId();
      setCompanyId(cId);

      if (!cId) {
        setError("Empresa não encontrada");
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
      setError(err.response?.data?.message || "Erro ao carregar pipeline");
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

    return { totalLeads, responseRate };
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
    if (!draggedCustomer) return;

    const cId = getCompanyId();
    if (!cId) return;

    try {
      await pipelineApi.moveCustomer(draggedCustomer.id, cId, {
        stageId: toStageId,
      });
      await loadBoard();
    } catch (err: any) {
      console.error("Error moving customer:", err);
      setError("Erro ao mover cliente");
    } finally {
      setDraggedCustomer(null);
      setDraggedFromStage(null);
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
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={spacing.page}>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4">
        <div className="flex justify-between mb-6">
          <div className="flex gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm w-56">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total de Leads</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm w-56">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taxa de Conversão</p>
                  <p className="text-2xl font-bold text-green-600">{stats.responseRate}%</p>
                </div>
              </div>
            </div>
          </div>
          <Button onClick={() => setManageStagesOpen(true)} variant="outline" className="border-gray-300">
            <Settings2 className="h-4 w-4 mr-2" />
            Gerenciar Estágios
          </Button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board?.stages.map((stageData) => (
            <div
              key={stageData.stage.id}
              className={cn(
                "flex-shrink-0 w-72 flex flex-col rounded-xl bg-white border shadow-sm transition-all",
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

              {/* Cards Container */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[200px]">
                {stageData.customers.map((customer) => (
                  <div
                    key={customer.id}
                    draggable
                    onDragStart={() => handleDragStart(customer, stageData.stage.id)}
                    onClick={() => handleCustomerClick(customer)}
                    className={cn(
                      "bg-gray-50 rounded-lg p-3 cursor-pointer border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group",
                      draggedCustomer?.id === customer.id && "opacity-50 scale-95"
                    )}
                  >
                    {/* Customer Name */}
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm text-gray-900 truncate flex-1">{customer.name}</p>
                      <GripVertical className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{formatPhone(customer.phone)}</span>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(customer.createdAt)}</span>
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
                              className="text-[10px] px-1.5 py-0"
                              style={tagColor ? {
                                backgroundColor: `${tagColor}20`,
                                borderColor: tagColor,
                                color: tagColor,
                              } : {
                                backgroundColor: 'white',
                                borderColor: '#e5e7eb',
                                color: '#4b5563',
                              }}
                            >
                              {tag}
                            </Badge>
                          );
                        })}
                        {customer.tags.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white border-gray-200 text-gray-600">
                            +{customer.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {stageData.customers.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">Arraste leads para cá</div>}
              </div>
            </div>
          ))}

          {/* Coluna de clientes sem estágio */}
          {board && board.customersWithoutStage.length > 0 && (
            <div
              className={cn(
                "flex-shrink-0 w-72 flex flex-col rounded-xl bg-white border-2 border-dashed transition-all",
                dragOverStageId === null && draggedCustomer ? "border-gray-400 ring-2 ring-gray-100" : "border-gray-300"
              )}
              onDragOver={(e) => handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(null)}
            >
              {/* Stage Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-500">Sem Estágio</span>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-500">
                    {board.customersWithoutStage.length}
                  </Badge>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] min-h-[200px]">
                {board.customersWithoutStage.map((customer) => (
                  <div
                    key={customer.id}
                    draggable
                    onDragStart={() => handleDragStart(customer, null)}
                    onClick={() => handleCustomerClick(customer)}
                    className={cn(
                      "bg-gray-50 rounded-lg p-3 cursor-pointer border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group",
                      draggedCustomer?.id === customer.id && "opacity-50 scale-95"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm text-gray-900 truncate flex-1">{customer.name}</p>
                      <GripVertical className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{formatPhone(customer.phone)}</span>
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
                              className="text-[10px] px-1.5 py-0"
                              style={tagColor ? {
                                backgroundColor: `${tagColor}20`,
                                borderColor: tagColor,
                                color: tagColor,
                              } : {
                                backgroundColor: 'white',
                                borderColor: '#e5e7eb',
                                color: '#4b5563',
                              }}
                            >
                              {tag}
                            </Badge>
                          );
                        })}
                        {customer.tags.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white border-gray-200 text-gray-600">
                            +{customer.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
