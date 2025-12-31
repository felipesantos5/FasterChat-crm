"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Save,
  Package,
  Variable,
  DollarSign,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { ProtectedPage } from "@/components/layout/protected-page";
import api from "@/lib/api";

interface ServiceOption {
  id?: string;
  name: string;
  priceModifier: number;
}

interface ServiceVariable {
  id?: string;
  name: string;
  description?: string;
  isRequired: boolean;
  options: ServiceOption[];
}

interface Service {
  id?: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  variables: ServiceVariable[];
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const response = await api.get("/services");
      const loadedServices = response.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        basePrice: Number(s.basePrice),
        isActive: s.isActive,
        variables: s.variables.map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description || "",
          isRequired: v.isRequired,
          options: v.options.map((o: any) => ({
            id: o.id,
            name: o.name,
            priceModifier: Number(o.priceModifier),
          })),
        })),
      }));
      setServices(loadedServices);
      // Expandir todos por padrão se houver poucos
      if (loadedServices.length <= 3) {
        setExpandedServices(new Set(loadedServices.map((_: any, i: number) => i)));
      }
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setIsLoading(false);
    }
  };

  const addService = () => {
    const newIndex = services.length;
    setServices([
      ...services,
      {
        name: "",
        description: "",
        basePrice: 0,
        isActive: true,
        variables: [],
      },
    ]);
    setExpandedServices(new Set([...expandedServices, newIndex]));
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
    const newExpanded = new Set(expandedServices);
    newExpanded.delete(index);
    setExpandedServices(newExpanded);
  };

  const updateService = (index: number, field: keyof Service, value: any) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const toggleServiceExpanded = (index: number) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedServices(newExpanded);
  };

  // Variables
  const addVariable = (serviceIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].variables.push({
      name: "",
      description: "",
      isRequired: true,
      options: [{ name: "", priceModifier: 0 }],
    });
    setServices(updated);
  };

  const removeVariable = (serviceIndex: number, varIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].variables = updated[serviceIndex].variables.filter(
      (_, i) => i !== varIndex
    );
    setServices(updated);
  };

  const updateVariable = (
    serviceIndex: number,
    varIndex: number,
    field: keyof ServiceVariable,
    value: any
  ) => {
    const updated = [...services];
    updated[serviceIndex].variables[varIndex] = {
      ...updated[serviceIndex].variables[varIndex],
      [field]: value,
    };
    setServices(updated);
  };

  // Options
  const addOption = (serviceIndex: number, varIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].variables[varIndex].options.push({
      name: "",
      priceModifier: 0,
    });
    setServices(updated);
  };

  const removeOption = (serviceIndex: number, varIndex: number, optIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].variables[varIndex].options = updated[serviceIndex].variables[
      varIndex
    ].options.filter((_, i) => i !== optIndex);
    setServices(updated);
  };

  const updateOption = (
    serviceIndex: number,
    varIndex: number,
    optIndex: number,
    field: keyof ServiceOption,
    value: any
  ) => {
    const updated = [...services];
    updated[serviceIndex].variables[varIndex].options[optIndex] = {
      ...updated[serviceIndex].variables[varIndex].options[optIndex],
      [field]: value,
    };
    setServices(updated);
  };

  const saveServices = async () => {
    // Validação básica
    for (const service of services) {
      if (!service.name.trim()) {
        toast.error("Todos os serviços precisam ter um nome");
        return;
      }
      for (const variable of service.variables) {
        if (!variable.name.trim()) {
          toast.error(`Todas as variáveis do serviço "${service.name}" precisam ter um nome`);
          return;
        }
        for (const option of variable.options) {
          if (!option.name.trim()) {
            toast.error(
              `Todas as opções da variável "${variable.name}" precisam ter um nome`
            );
            return;
          }
        }
      }
    }

    setIsSaving(true);
    try {
      // Salvar cada serviço
      for (const service of services) {
        await api.post("/services/save-complete", service);
      }
      toast.success("Serviços salvos com sucesso!");
      loadServices(); // Recarregar para obter IDs
    } catch (error) {
      console.error("Erro ao salvar serviços:", error);
      toast.error("Erro ao salvar serviços");
    } finally {
      setIsSaving(false);
    }
  };

  const formatPrice = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const calculateExamplePrice = (service: Service) => {
    let total = service.basePrice;
    service.variables.forEach((variable) => {
      if (variable.options.length > 0) {
        // Pega a primeira opção como exemplo
        total += variable.options[0].priceModifier;
      }
    });
    return total;
  };

  if (isLoading) {
    return (
      <ProtectedPage requiredPage="AI_CONFIG">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage requiredPage="AI_CONFIG">
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Serviços e Preços
            </h1>
            <p className="text-gray-500 mt-1">
              Configure seus serviços com variáveis de preço para orçamentos automáticos
            </p>
          </div>
          <button
            onClick={saveServices}
            disabled={isSaving || services.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Salvar
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3">
          <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Como funciona?</p>
            <p>
              Cadastre seus serviços com um <strong>preço base</strong> e adicione{" "}
              <strong>variáveis</strong> que modificam o preço final. Por exemplo: uma
              instalação de ar condicionado pode ter variáveis como BTUs, tipo de acesso
              (escada/rapel) e região.
            </p>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-4">
          {services.map((service, serviceIndex) => (
            <div
              key={serviceIndex}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Service Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleServiceExpanded(serviceIndex)}
              >
                <div className="text-gray-400 cursor-grab">
                  <GripVertical className="w-5 h-5" />
                </div>

                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-green-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={service.name}
                    onChange={(e) => updateService(serviceIndex, "name", e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Nome do serviço (ex: Instalação de Ar Condicionado)"
                    className="w-full text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400"
                  />
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>Base: {formatPrice(service.basePrice)}</span>
                    <span>•</span>
                    <span>{service.variables.length} variáveis</span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeService(serviceIndex);
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                {expandedServices.has(serviceIndex) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Service Content (Expanded) */}
              {expandedServices.has(serviceIndex) && (
                <div className="border-t border-gray-100 p-4 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Descrição (opcional)
                      </label>
                      <input
                        type="text"
                        value={service.description || ""}
                        onChange={(e) =>
                          updateService(serviceIndex, "description", e.target.value)
                        }
                        placeholder="Breve descrição do serviço"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Preço Base (R$)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={service.basePrice}
                          onChange={(e) =>
                            updateService(
                              serviceIndex,
                              "basePrice",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Variables Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Variable className="w-4 h-4" />
                        Variáveis de Preço
                      </h3>
                      <button
                        onClick={() => addVariable(serviceIndex)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Variável
                      </button>
                    </div>

                    {service.variables.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <Variable className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          Nenhuma variável cadastrada
                        </p>
                        <button
                          onClick={() => addVariable(serviceIndex)}
                          className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          + Adicionar primeira variável
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {service.variables.map((variable, varIndex) => (
                          <div
                            key={varIndex}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            {/* Variable Header */}
                            <div className="flex items-start gap-3 mb-4">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={variable.name}
                                  onChange={(e) =>
                                    updateVariable(
                                      serviceIndex,
                                      varIndex,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Nome da variável (ex: BTUs, Tipo de Acesso)"
                                  className="w-full px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                              <button
                                onClick={() => removeVariable(serviceIndex, varIndex)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Options */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Opções
                                </span>
                              </div>

                              {variable.options.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200"
                                >
                                  <input
                                    type="text"
                                    value={option.name}
                                    onChange={(e) =>
                                      updateOption(
                                        serviceIndex,
                                        varIndex,
                                        optIndex,
                                        "name",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Nome da opção"
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                  />
                                  <div className="relative w-32">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                      R$
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={option.priceModifier}
                                      onChange={(e) =>
                                        updateOption(
                                          serviceIndex,
                                          varIndex,
                                          optIndex,
                                          "priceModifier",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-right"
                                    />
                                  </div>
                                  <button
                                    onClick={() =>
                                      removeOption(serviceIndex, varIndex, optIndex)
                                    }
                                    disabled={variable.options.length <= 1}
                                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}

                              <button
                                onClick={() => addOption(serviceIndex, varIndex)}
                                className="w-full py-2 text-sm text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg border-2 border-dashed border-gray-200 hover:border-green-300 transition-colors"
                              >
                                + Adicionar opção
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Example Calculation */}
                  {service.variables.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-medium text-green-800 mb-2">
                        Exemplo de cálculo
                      </h4>
                      <div className="space-y-1 text-sm text-green-700">
                        <div className="flex justify-between">
                          <span>Preço base</span>
                          <span>{formatPrice(service.basePrice)}</span>
                        </div>
                        {service.variables.map(
                          (variable, vIdx) =>
                            variable.options[0] && (
                              <div key={vIdx} className="flex justify-between">
                                <span>
                                  {variable.name || "Variável"}: {variable.options[0].name || "Opção 1"}
                                </span>
                                <span>
                                  {variable.options[0].priceModifier >= 0 ? "+" : ""}
                                  {formatPrice(variable.options[0].priceModifier)}
                                </span>
                              </div>
                            )
                        )}
                        <div className="flex justify-between pt-2 border-t border-green-300 font-semibold">
                          <span>Total</span>
                          <span>{formatPrice(calculateExamplePrice(service))}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Service Button */}
        <button
          onClick={addService}
          className="w-full mt-4 py-4 flex items-center justify-center gap-2 text-gray-500 hover:text-green-600 bg-white hover:bg-green-50 rounded-xl border-2 border-dashed border-gray-200 hover:border-green-300 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Adicionar Serviço</span>
        </button>

        {/* Empty State */}
        {services.length === 0 && (
          <div className="text-center py-12 mt-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Nenhum serviço cadastrado
            </h3>
            <p className="text-gray-500 mb-4">
              Comece criando seu primeiro serviço com variáveis de preço
            </p>
            <button
              onClick={addService}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar primeiro serviço
            </button>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
