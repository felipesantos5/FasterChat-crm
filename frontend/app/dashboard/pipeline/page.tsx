"use client";

import { useState, useEffect } from "react";
import { pipelineApi } from "@/lib/pipeline";
import { PipelineBoard, PipelineStage, StageWithCustomers } from "@/types/pipeline";
import { Customer } from "@/types/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Settings2, Mail, Phone, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function PipelinePage() {
  const router = useRouter();
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedCustomer, setDraggedCustomer] = useState<Customer | null>(null);
  const [draggedFromStage, setDraggedFromStage] = useState<string | null>(null);

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
      const companyId = getCompanyId();

      if (!companyId) {
        setError("Empresa não encontrada");
        return;
      }

      const data = await pipelineApi.getBoard(companyId);

      // Se não tem estágios, inicializa com estágios padrão
      if (data.stages.length === 0) {
        console.log("Inicializando pipeline com estágios padrão...");
        await pipelineApi.initPipeline(companyId);
        const newData = await pipelineApi.getBoard(companyId);
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

  const handleDragStart = (customer: Customer, fromStageId: string | null) => {
    setDraggedCustomer(customer);
    setDraggedFromStage(fromStageId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toStageId: string | null) => {
    if (!draggedCustomer) return;

    const companyId = getCompanyId();
    if (!companyId) return;

    try {
      await pipelineApi.moveCustomer(draggedCustomer.id, companyId, {
        stageId: toStageId,
      });

      // Atualiza o board localmente
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline de Vendas</h1>
          <p className="text-muted-foreground">
            Organize seus clientes no funil de vendas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings2 className="h-4 w-4 mr-2" />
            Gerenciar Estágios
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board?.stages.map((stageData) => (
          <div
            key={stageData.stage.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stageData.stage.id)}
          >
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stageData.stage.color }}
                    />
                    <CardTitle className="text-sm font-medium">
                      {stageData.stage.name}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {stageData.customers.length}
                  </Badge>
                </div>
                {stageData.stage.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stageData.stage.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {stageData.customers.map((customer) => (
                  <div
                    key={customer.id}
                    draggable
                    onDragStart={() => handleDragStart(customer, stageData.stage.id)}
                    onClick={() => handleCustomerClick(customer)}
                    className={cn(
                      "p-3 rounded-lg border bg-card cursor-move hover:shadow-md transition-all",
                      draggedCustomer?.id === customer.id && "opacity-50"
                    )}
                  >
                    <div className="space-y-2">
                      <p className="font-medium text-sm">{customer.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {customer.tags.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{customer.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Coluna de clientes sem estágio */}
        {board && board.customersWithoutStage.length > 0 && (
          <div
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(null)}
          >
            <Card className="h-full border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sem Estágio
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {board.customersWithoutStage.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {board.customersWithoutStage.map((customer) => (
                  <div
                    key={customer.id}
                    draggable
                    onDragStart={() => handleDragStart(customer, null)}
                    onClick={() => handleCustomerClick(customer)}
                    className={cn(
                      "p-3 rounded-lg border bg-card cursor-move hover:shadow-md transition-all",
                      draggedCustomer?.id === customer.id && "opacity-50"
                    )}
                  >
                    <div className="space-y-2">
                      <p className="font-medium text-sm">{customer.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
