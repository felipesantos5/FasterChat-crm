"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { aiKnowledgeApi } from "@/lib/ai-knowledge";
import { AIKnowledge, Product, ObjectivePreset } from "@/types/ai-knowledge";
import {
  Loader2,
  Check,
  Building2,
  Target,
  FileText,
  Package,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Edit3,
  X,
  Wand2,
  Clock,
  CreditCard,
  Truck,
  Shield,
  Headphones,
  ShoppingCart,
  CalendarCheck,
  Calendar,
  Info,
  UserCheck,
  PackageSearch,
  Settings,
  LucideIcon,
  Wrench,
  ChevronDown,
  ChevronUp,
  Variable,
  DollarSign,
  Hash,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";
import api from "@/lib/api";

// Interfaces para Serviços com Variações
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

// Interface para faixas de preço por quantidade
interface PricingTier {
  id?: string;
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: number;
}

type ServiceType = "PRODUCT" | "SERVICE";

interface Service {
  id?: string;
  name: string;
  description?: string;
  basePrice: number;
  type: ServiceType;
  category?: string;
  isActive: boolean;
  duration?: number; // Duração em minutos (padrão: 60)
  variables: ServiceVariable[];
  pricingTiers?: PricingTier[]; // Faixas de preço por quantidade
  usePricingTiers?: boolean; // Flag para usar faixas ao invés de preço base
}

// Mapeamento de ícones para os objetivos
const OBJECTIVE_ICONS: Record<string, LucideIcon> = {
  support: Headphones,
  sales: ShoppingCart,
  sales_scheduling: CalendarCheck,
  scheduling_only: Calendar,
  info_faq: Info,
  lead_qualification: UserCheck,
  order_tracking: PackageSearch,
  custom: Settings,
};

// Definição dos steps do wizard
const STEPS = [
  { id: 0, title: "Sua Empresa", icon: Building2, description: "Informações básicas" },
  { id: 1, title: "Objetivo da IA", icon: Target, description: "Como a IA deve agir" },
  { id: 2, title: "Comportamento", icon: MessageSquare, description: "Tom e atendimento" },
  { id: 3, title: "Políticas", icon: FileText, description: "Regras do negócio" },
  { id: 4, title: "Produtos", icon: Package, description: "O que você oferece" },
  { id: 5, title: "Serviços", icon: Wrench, description: "Serviços com variações" },
  { id: 6, title: "Finalizar", icon: Sparkles, description: "Gerar contexto" },
];

// Segmentos de negócio sugeridos
const SEGMENTS = [
  "E-commerce / Loja Online",
  "Prestação de Serviços",
  "Restaurante / Alimentação",
  "Saúde / Clínica",
  "Educação / Cursos",
  "Tecnologia / Software",
  "Consultoria",
  "Varejo / Loja Física",
  "Imobiliário",
  "Automotivo",
  "Beleza / Estética",
  "Outro",
];

export default function AISettingsPage() {
  return (
    <ProtectedPage requiredPage="AI_CONFIG">
      <AISettingsPageContent />
    </ProtectedPage>
  );
}

function AISettingsPageContent() {
  const [knowledge, setKnowledge] = useState<AIKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const { hasError, handleError, clearError } = useErrorHandler();
  const [saving, setSaving] = useState(false);
  const [generatingContext, setGeneratingContext] = useState(false);

  // Estado do wizard
  const [currentStep, setCurrentStep] = useState(0);
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Campos do formulário
  const [companyName, setCompanyName] = useState("");
  const [companySegment, setCompanySegment] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  const [objectiveType, setObjectiveType] = useState("support");
  const [objectivePresets, setObjectivePresets] = useState<ObjectivePreset[]>([]);
  const [aiObjective, setAiObjective] = useState(""); // Usado apenas quando objectiveType === 'custom'

  const [workingHours, setWorkingHours] = useState("");
  const [businessHoursStart, setBusinessHoursStart] = useState<number>(9);
  const [businessHoursEnd, setBusinessHoursEnd] = useState<number>(18);
  const [paymentMethods, setPaymentMethods] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [warrantyInfo, setWarrantyInfo] = useState("");

  // Estados para Comportamento da IA
  const [pricingBehavior, setPricingBehavior] = useState<'SHOW_IMMEDIATELY' | 'ASK_FIRST' | 'NEVER_SHOW'>('SHOW_IMMEDIATELY');
  const [toneOfVoice, setToneOfVoice] = useState<'FORMAL' | 'FRIENDLY' | 'TECHNICAL'>('FRIENDLY');
  const [consultativeMode, setConsultativeMode] = useState(false);
  const [requiredInfoBeforeQuote, setRequiredInfoBeforeQuote] = useState<string[]>([]);
  const [customGreeting, setCustomGreeting] = useState("");
  const [customQualifyingQuestions, setCustomQualifyingQuestions] = useState<string[]>([]);
  const [newRequiredInfo, setNewRequiredInfo] = useState("");
  const [newQuestion, setNewQuestion] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [generatedContext, setGeneratedContext] = useState("");

  // Estados para Serviços com Variações
  const [services, setServices] = useState<Service[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  // Produto em edição
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    duration: "", // Duração em minutos
    salesLink: "", // Link de venda/checkout
  });

  // Função para formatar valor monetário
  const formatCurrency = (value: string): string => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");

    if (!numbers) return "";

    // Converte para número e divide por 100 (centavos)
    const amount = parseInt(numbers) / 100;

    // Formata como moeda brasileira
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Handler para mudança de preço com máscara
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setProductForm({ ...productForm, price: formatted });
  };

  const getCompanyId = () => {
    const user = localStorage.getItem("user");
    if (user) {
      const userData = JSON.parse(user);
      return userData.companyId;
    }
    return null;
  };

  // Função para carregar serviços
  const loadServices = async () => {
    try {
      const response = await api.get("/services");
      const loadedServices = response.data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        basePrice: Number(s.basePrice),
        type: s.type || "SERVICE",
        category: s.category || "",
        duration: s.duration ?? 60, // Duração em minutos (padrão: 60)
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
        // Carrega faixas de preço se existirem
        pricingTiers: s.pricingTiers?.map((t: any) => ({
          id: t.id,
          minQuantity: t.minQuantity,
          maxQuantity: t.maxQuantity,
          pricePerUnit: Number(t.pricePerUnit),
        })) || [],
        usePricingTiers: s.pricingTiers && s.pricingTiers.length > 0,
      }));
      setServices(loadedServices);
      // Expandir todos por padrão se houver poucos
      if (loadedServices.length <= 3) {
        setExpandedServices(new Set(loadedServices.map((_: any, i: number) => i)));
      }
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    }
  };

  const loadKnowledge = async () => {
    try {
      clearError();
      const companyId = getCompanyId();
      if (!companyId) {
        handleError("Empresa não encontrada");
        return;
      }

      // Carrega os presets de objetivos
      try {
        const presetsResponse = await aiKnowledgeApi.getObjectivePresets();
        if (presetsResponse.data) {
          setObjectivePresets(presetsResponse.data);
        }
      } catch (err) {
        console.error("Error loading presets:", err);
      }

      // Carrega os serviços em paralelo
      loadServices();

      const response = await aiKnowledgeApi.getKnowledge(companyId);

      if (response.data) {
        setKnowledge(response.data);

        // Preenche os campos
        setCompanyName(response.data.companyName || "");
        setCompanySegment(response.data.companySegment || "");
        setCompanyDescription(response.data.companyDescription || response.data.companyInfo || "");

        setObjectiveType(response.data.objectiveType || "support");
        setAiObjective(response.data.aiObjective || "");

        setWorkingHours(response.data.workingHours || "");
        setBusinessHoursStart(response.data.businessHoursStart ?? 9);
        setBusinessHoursEnd(response.data.businessHoursEnd ?? 18);
        setPaymentMethods(response.data.paymentMethods || "");
        setDeliveryInfo(response.data.deliveryInfo || "");
        setWarrantyInfo(response.data.warrantyInfo || "");

        // Comportamento da IA
        setPricingBehavior(response.data.pricingBehavior || 'SHOW_IMMEDIATELY');
        setToneOfVoice(response.data.toneOfVoice || 'FRIENDLY');
        setConsultativeMode(response.data.consultativeMode || false);
        setRequiredInfoBeforeQuote(response.data.requiredInfoBeforeQuote || []);
        setCustomGreeting(response.data.customGreeting || "");
        setCustomQualifyingQuestions(response.data.customQualifyingQuestions || []);

        // CORREÇÃO DA TELA BRANCA: Garante que products é sempre um array
        setProducts(Array.isArray(response.data.products) ? response.data.products : []);

        setAutoReplyEnabled(response.data.autoReplyEnabled ?? true);
        setGeneratedContext(response.data.generatedContext || "");
        setSetupCompleted(response.data.setupCompleted ?? false);
        setCurrentStep(response.data.setupStep ?? 0);
      }
    } catch (err: any) {
      console.error("Error loading knowledge:", err);
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  const saveKnowledge = async (nextStep?: number, overrides?: { autoReplyEnabled?: boolean }) => {
    try {
      setSaving(true);
      const companyId = getCompanyId();
      if (!companyId) {
        toast.error("Empresa não encontrada");
        return;
      }

      await aiKnowledgeApi.updateKnowledge({
        companyId,
        companyName,
        companySegment,
        companyDescription,
        objectiveType,
        aiObjective: objectiveType === 'custom' ? aiObjective : undefined,
        pricingBehavior,
        toneOfVoice,
        consultativeMode,
        requiredInfoBeforeQuote,
        customGreeting,
        customQualifyingQuestions,
        workingHours,
        businessHoursStart,
        businessHoursEnd,
        paymentMethods,
        deliveryInfo,
        warrantyInfo,
        products, // Importante: Salva os produtos atuais
        // Preserva o FAQ se existir no objeto knowledge original
        faq: knowledge?.faq || undefined,
        autoReplyEnabled: overrides?.autoReplyEnabled ?? autoReplyEnabled,
        setupStep: nextStep ?? currentStep,
        setupCompleted,
      });

      toast.success("Configurações salvas!");
    } catch (err: any) {
      console.error("Error saving:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep = async () => {
    const nextStep = currentStep + 1;

    // Se está saindo do step de serviços (step 4), salva os serviços primeiro
    if (currentStep === 5 && services.length > 0) {
      const servicesSaved = await saveServices();
      if (!servicesSaved) {
        return; // Se falhou a validação, não avança
      }
    }

    await saveKnowledge(nextStep);
    setCurrentStep(nextStep);

    // Se chegou no último step (Finalizar), gera o contexto automaticamente
    if (nextStep === 5) {
      setTimeout(() => {
        handleGenerateContext();
      }, 500); // Pequeno delay para garantir que o step foi atualizado
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleGenerateContext = async () => {
    try {
      setGeneratingContext(true);
      const companyId = getCompanyId();
      if (!companyId) {
        toast.error("Empresa não encontrada");
        return;
      }

      // Primeiro salva todas as informações (incluindo produtos)
      await saveKnowledge();

      // Depois gera o contexto
      const response = await aiKnowledgeApi.generateContext(companyId);

      if (response.data) {
        setGeneratedContext(response.data.generatedContext);
        setSetupCompleted(true);

        // CORREÇÃO DO ERRO DE SALVAMENTO:
        // Envia TODOS os dados novamente, INCLUINDO os produtos.
        // Se enviarmos sem produtos, o backend entende como [] e apaga tudo.
        await aiKnowledgeApi.updateKnowledge({
          companyId,
          companyName,
          companySegment,
          companyDescription,
          objectiveType,
          aiObjective: objectiveType === 'custom' ? aiObjective : undefined,
          workingHours,
          businessHoursStart,
          businessHoursEnd,
          paymentMethods,
          deliveryInfo,
          warrantyInfo,
          products, // <--- OBRIGATÓRIO PARA NÃO APAGAR OS PRODUTOS
          faq: knowledge?.faq || undefined, // Preserva FAQ
          autoReplyEnabled,
          setupStep: 4,
          setupCompleted: true, // Força o status de completo
        });

        toast.success("Contexto gerado com sucesso! Sua IA está pronta para atender.");
      }
    } catch (err: any) {
      console.error("Error generating context:", err);
      toast.error("Erro ao gerar contexto. Tente novamente.");
    } finally {
      setGeneratingContext(false);
    }
  };

  const handleAddProduct = () => {
    if (!productForm.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    const newProduct: Product = {
      id: editingProduct?.id || crypto.randomUUID(),
      name: productForm.name.trim(),
      description: productForm.description.trim(),
      price: productForm.price.trim(),
      category: productForm.category.trim(),
      duration: productForm.duration ? parseInt(productForm.duration) : undefined,
      salesLink: productForm.salesLink.trim() || undefined,
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts([...products, newProduct]);
    }

    setProductForm({ name: "", description: "", price: "", category: "", duration: "", salesLink: "" });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price || "",
      category: product.category || "",
      duration: product.duration ? product.duration.toString() : "",
      salesLink: product.salesLink || "",
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    const updatedProducts = products.filter(p => p.id !== productId);
    setProducts(updatedProducts);

    // Salva imediatamente para persistir a deleção
    try {
      const companyId = getCompanyId();
      if (companyId) {
        await aiKnowledgeApi.updateKnowledge({
          companyId,
          products: updatedProducts,
        });
        toast.success("Produto removido!");
      }
    } catch (error) {
      console.error("Erro ao salvar após deletar produto:", error);
      toast.error("Erro ao remover produto");
      // Reverte a deleção local em caso de erro
      setProducts(products);
    }
  };

  // === Funções de Serviços com Variações ===
  const addService = () => {
    const newIndex = services.length;
    setServices([
      ...services,
      {
        name: "",
        description: "",
        basePrice: 0,
        type: "SERVICE",
        category: "",
        isActive: true,
        duration: 60, // Duração padrão: 60 minutos
        variables: [],
        pricingTiers: [],
        usePricingTiers: false,
      },
    ]);
    setExpandedServices(new Set([...expandedServices, newIndex]));
  };

  const removeService = async (index: number) => {
    const serviceToRemove = services[index];

    // Se o serviço tem ID, significa que já foi salvo no banco - precisa deletar via API
    if (serviceToRemove?.id) {
      try {
        await api.delete(`/services/${serviceToRemove.id}`);
        toast.success("Serviço removido com sucesso!");
      } catch (error) {
        console.error("Erro ao deletar serviço:", error);
        toast.error("Erro ao remover serviço do servidor");
        return; // Não remove do estado local se falhou no servidor
      }
    }

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

  // === Funções de Faixas de Preço ===
  const toggleUsePricingTiers = (serviceIndex: number) => {
    const updated = [...services];
    const currentValue = updated[serviceIndex].usePricingTiers || false;
    updated[serviceIndex].usePricingTiers = !currentValue;

    // Se ativando e não tem faixas, adiciona uma padrão
    if (!currentValue && (!updated[serviceIndex].pricingTiers || updated[serviceIndex].pricingTiers!.length === 0)) {
      updated[serviceIndex].pricingTiers = [
        { minQuantity: 1, maxQuantity: 1, pricePerUnit: updated[serviceIndex].basePrice || 0 },
      ];
    }
    setServices(updated);
  };

  const addPricingTier = (serviceIndex: number) => {
    const updated = [...services];
    const tiers = updated[serviceIndex].pricingTiers || [];
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier ? (lastTier.maxQuantity || lastTier.minQuantity) + 1 : 1;

    updated[serviceIndex].pricingTiers = [
      ...tiers,
      { minQuantity: newMin, maxQuantity: null, pricePerUnit: 0 },
    ];
    setServices(updated);
  };

  const removePricingTier = (serviceIndex: number, tierIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].pricingTiers = updated[serviceIndex].pricingTiers?.filter((_, i) => i !== tierIndex) || [];
    setServices(updated);
  };

  const updatePricingTier = (
    serviceIndex: number,
    tierIndex: number,
    field: keyof PricingTier,
    value: any
  ) => {
    const updated = [...services];
    if (updated[serviceIndex].pricingTiers) {
      updated[serviceIndex].pricingTiers![tierIndex] = {
        ...updated[serviceIndex].pricingTiers![tierIndex],
        [field]: value,
      };
    }
    setServices(updated);
  };

  const saveServices = async () => {
    // Validação básica
    for (const service of services) {
      if (!service.name.trim()) {
        toast.error("Todos os serviços precisam ter um nome");
        return false;
      }

      // Validação de faixas de preço
      if (service.usePricingTiers && service.pricingTiers && service.pricingTiers.length > 0) {
        for (const tier of service.pricingTiers) {
          if (tier.pricePerUnit <= 0) {
            toast.error(`O serviço "${service.name}" tem faixas de preço com valor zerado`);
            return false;
          }
        }
      }

      for (const variable of service.variables) {
        if (!variable.name.trim()) {
          toast.error(`Todas as variáveis do serviço "${service.name}" precisam ter um nome`);
          return false;
        }
        for (const option of variable.options) {
          if (!option.name.trim()) {
            toast.error(
              `Todas as opções da variável "${variable.name}" precisam ter um nome`
            );
            return false;
          }
        }
      }
    }

    try {
      // Salvar cada serviço
      for (const service of services) {
        const response = await api.post("/services/save-complete", service);
        const savedServiceId = response.data?.id || service.id;

        // Se tem faixas de preço configuradas, salva elas também
        if (savedServiceId && service.usePricingTiers && service.pricingTiers && service.pricingTiers.length > 0) {
          try {
            await api.put(`/services/${savedServiceId}/pricing-tiers`, {
              tiers: service.pricingTiers.map(tier => ({
                minQuantity: tier.minQuantity,
                maxQuantity: tier.maxQuantity,
                pricePerUnit: tier.pricePerUnit,
              })),
            });
          } catch (tierError) {
            console.error("Erro ao salvar faixas de preço:", tierError);
            // Não falha completamente, apenas loga o erro
          }
        }
      }
      return true;
    } catch (error) {
      console.error("Erro ao salvar serviços:", error);
      toast.error("Erro ao salvar serviços");
      return false;
    }
  };

  const formatServicePrice = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const calculateExamplePrice = (service: Service) => {
    let total = service.basePrice;
    service.variables.forEach((variable) => {
      if (variable.options.length > 0) {
        total += variable.options[0].priceModifier;
      }
    });
    return total;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="mb-8">
          <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-40 bg-muted rounded-lg animate-pulse" />
          <div className="h-48 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return <LoadingErrorState resource="configurações da IA" onRetry={loadKnowledge} />;
  }

  // Se setup completo, mostra visão geral
  if (setupCompleted) {
    return <CompletedView
      knowledge={knowledge}
      companyName={companyName}
      companySegment={companySegment}
      companyDescription={companyDescription}
      objectiveType={objectiveType}
      objectivePresets={objectivePresets}
      aiObjective={aiObjective}
      workingHours={workingHours}
      businessHoursStart={businessHoursStart}
      businessHoursEnd={businessHoursEnd}
      paymentMethods={paymentMethods}
      deliveryInfo={deliveryInfo}
      warrantyInfo={warrantyInfo}
      products={products}
      services={services}
      generatedContext={generatedContext}
      autoReplyEnabled={autoReplyEnabled}
      onEdit={() => setSetupCompleted(false)}
      onRegenerate={handleGenerateContext}
      generatingContext={generatingContext}
      setAutoReplyEnabled={setAutoReplyEnabled}
      saveKnowledge={saveKnowledge}
    />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header com Steps */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Configuração da IA</h1>
        <p className="text-muted-foreground">
          Configure sua assistente virtual em poucos passos
        </p>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-6 mb-8">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity",
                  index <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    index < currentStep
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentStep
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-xs mt-1 font-medium hidden sm:block">
                  {step.title}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-12 sm:w-20 h-0.5 mx-2",
                    index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {(() => {
              const StepIcon = STEPS[currentStep].icon;
              return <StepIcon className="h-5 w-5" />;
            })()}
            {STEPS[currentStep].title}
          </CardTitle>
          <CardDescription>{STEPS[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Informações da Empresa */}
          {currentStep === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Digite o nome da sua empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySegment">Segmento de Atuação</Label>
                <div className="flex flex-wrap gap-2">
                  {SEGMENTS.map((segment) => (
                    <Badge
                      key={segment}
                      variant={companySegment === segment ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => setCompanySegment(segment)}
                    >
                      {segment}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyDescription">Descreva sua empresa</Label>
                <Textarea
                  id="companyDescription"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  placeholder="Conte um pouco sobre o que sua empresa faz, sua história, missão e valores..."
                  rows={8}
                  className="min-h-[180px]"
                />
                <p className="text-xs text-muted-foreground">
                  Quanto mais detalhes você fornecer, melhor a IA entenderá seu negócio.
                </p>
              </div>
            </>
          )}

          {/* Step 1: Objetivo da IA */}
          {currentStep === 1 && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Selecione o objetivo da sua IA</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha o tipo de atendimento que melhor se adequa ao seu negócio
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {objectivePresets.map((preset) => {
                    const IconComponent = OBJECTIVE_ICONS[preset.id] || Target;
                    const isSelected = objectiveType === preset.id;

                    return (
                      <button
                        type="button"
                        key={preset.id}
                        onClick={() => setObjectiveType(preset.id)}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:bg-muted/50"
                        )}
                      >
                        <div
                          className={cn(
                            "p-2 rounded-lg shrink-0",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{preset.label}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {preset.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campo customizado quando seleciona "Personalizado" */}
              {objectiveType === "custom" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="aiObjective">Descreva o objetivo personalizado</Label>
                  <Textarea
                    id="aiObjective"
                    value={aiObjective}
                    onChange={(e) => setAiObjective(e.target.value)}
                    placeholder="Ex: Atender clientes, responder dúvidas, fornecer informações sobre produtos e serviços, agendar atendimentos..."
                    rows={6}
                    className="min-h-[140px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Descreva detalhadamente o que você espera que a IA faça ao atender seus clientes.
                  </p>
                </div>
              )}

            </>
          )}

          {/* Step 2: Comportamento */}
          {currentStep === 2 && (
            <>
              {/* Comportamento de Preços */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Comportamento de Preços
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Como a IA deve lidar com perguntas sobre valores
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    { value: 'SHOW_IMMEDIATELY' as const, label: 'Mostrar Imediatamente', desc: 'A IA informa preços assim que o cliente perguntar' },
                    { value: 'ASK_FIRST' as const, label: 'Perguntar Antes (Recomendado)', desc: 'A IA coleta informações do cliente antes de passar valores' },
                    { value: 'NEVER_SHOW' as const, label: 'Não Mostrar Preços', desc: 'A IA nunca informa preços, sempre direciona para atendimento' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPricingBehavior(option.value)}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
                        pricingBehavior === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/20 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                        pricingBehavior === option.value ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )}>
                        {pricingBehavior === option.value && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{option.label}</span>
                          {option.value === 'ASK_FIRST' && (
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">Recomendado</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {pricingBehavior === 'ASK_FIRST' && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-medium">Informações obrigatórias antes do orçamento</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      A IA vai coletar essas informações antes de informar valores
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {requiredInfoBeforeQuote.map((info, i) => (
                        <Badge key={i} variant="secondary" className="bg-background border px-3 py-1">
                          {info}
                          <button onClick={() => setRequiredInfoBeforeQuote(requiredInfoBeforeQuote.filter((_, idx) => idx !== i))} className="ml-2 text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newRequiredInfo}
                        onChange={(e) => setNewRequiredInfo(e.target.value)}
                        placeholder="Ex: Quantidade de aparelhos"
                        className="flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newRequiredInfo.trim()) {
                            setRequiredInfoBeforeQuote([...requiredInfoBeforeQuote, newRequiredInfo.trim()]);
                            setNewRequiredInfo("");
                          }
                        }}
                      />
                      <Button type="button" onClick={() => {
                        if (newRequiredInfo.trim()) {
                          setRequiredInfoBeforeQuote([...requiredInfoBeforeQuote, newRequiredInfo.trim()]);
                          setNewRequiredInfo("");
                        }
                      }} variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tom de Voz */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Tom de Voz
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha o estilo de comunicação da IA
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'FRIENDLY' as const, label: 'Amigável', emoji: '😊', desc: 'Cordial e acessível' },
                    { value: 'FORMAL' as const, label: 'Formal', emoji: '👔', desc: 'Profissional e respeitoso' },
                    { value: 'TECHNICAL' as const, label: 'Técnico', emoji: '🔧', desc: 'Especializado e detalhado' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setToneOfVoice(option.value)}
                      className={cn(
                        "p-4 rounded-lg border-2 text-center transition-all",
                        toneOfVoice === option.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/20 hover:bg-muted/50"
                      )}
                    >
                      <div className="text-3xl mb-2">{option.emoji}</div>
                      <div className="font-medium">{option.label}</div>
                      <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo Consultivo */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Modo Consultivo
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      A IA faz perguntas para entender melhor a necessidade
                    </p>
                  </div>
                  <Switch
                    checked={consultativeMode}
                    onCheckedChange={setConsultativeMode}
                  />
                </div>

                {consultativeMode && (
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-medium">Perguntas de qualificação</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Perguntas que a IA pode fazer para entender a necessidade do cliente
                    </p>
                    <div className="space-y-2 mb-3">
                      {customQualifyingQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-background rounded border">
                          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 text-sm">{q}</span>
                          <button onClick={() => setCustomQualifyingQuestions(customQualifyingQuestions.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Ex: Qual a marca do seu equipamento?"
                        className="flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newQuestion.trim()) {
                            setCustomQualifyingQuestions([...customQualifyingQuestions, newQuestion.trim()]);
                            setNewQuestion("");
                          }
                        }}
                      />
                      <Button type="button" onClick={() => {
                        if (newQuestion.trim()) {
                          setCustomQualifyingQuestions([...customQualifyingQuestions, newQuestion.trim()]);
                          setNewQuestion("");
                        }
                      }} variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Saudação Personalizada */}
              <div className="space-y-2">
                <Label htmlFor="customGreeting" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Saudação Personalizada (Opcional)
                </Label>
                <Textarea
                  id="customGreeting"
                  value={customGreeting}
                  onChange={(e) => setCustomGreeting(e.target.value)}
                  placeholder="Ex: Olá! Seja bem-vindo à [Nome da Empresa]! Como posso te ajudar hoje?"
                  rows={3}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para usar a saudação padrão
                </p>
              </div>
            </>
          )}

          {/* Step 3: Políticas */}
          {currentStep === 3 && (
            <>
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário de Funcionamento
                </Label>
                <p className="text-sm text-muted-foreground -mt-2">
                  Defina o horário comercial que a IA usará para mostrar horários disponíveis ao agendar
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="businessHoursStart" className="text-sm font-normal">Das</Label>
                    <select
                      id="businessHoursStart"
                      value={businessHoursStart}
                      onChange={(e) => setBusinessHoursStart(parseInt(e.target.value))}
                      className="flex h-9 w-[85px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="businessHoursEnd" className="text-sm font-normal">até</Label>
                    <select
                      id="businessHoursEnd"
                      value={businessHoursEnd}
                      onChange={(e) => setBusinessHoursEnd(parseInt(e.target.value))}
                      className="flex h-9 w-[85px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                </div>
                {businessHoursStart >= businessHoursEnd && (
                  <p className="text-sm text-destructive">O horário de início deve ser menor que o de fim</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workingHours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Detalhes do Horário de Atendimento (opcional)
                </Label>
                <Textarea
                  id="workingHours"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="Ex: Segunda a Sexta: 8h às 18h | Sábado: 8h às 13h | Domingo: Fechado (informação adicional para a IA)"
                  rows={2}
                  className="min-h-[60px]"
                />
                <p className="text-xs text-muted-foreground">
                  Informação textual que a IA pode usar para responder sobre horário de funcionamento
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethods" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Formas de Pagamento
                </Label>
                <Textarea
                  id="paymentMethods"
                  value={paymentMethods}
                  onChange={(e) => setPaymentMethods(e.target.value)}
                  placeholder="Ex: PIX (5% desconto), Cartão de Crédito (até 12x), Cartão de Débito, Dinheiro, Boleto..."
                  rows={3}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryInfo" className="flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Entrega / Prazos
                </Label>
                <Textarea
                  id="deliveryInfo"
                  value={deliveryInfo}
                  onChange={(e) => setDeliveryInfo(e.target.value)}
                  placeholder="Ex: Prazo de entrega, condições de frete, área de atendimento, tempo para orçamentos..."
                  rows={5}
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warrantyInfo" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Garantias
                </Label>
                <Textarea
                  id="warrantyInfo"
                  value={warrantyInfo}
                  onChange={(e) => setWarrantyInfo(e.target.value)}
                  placeholder="Ex: Política de garantia, prazo para trocas, condições, o que não é coberto..."
                  rows={5}
                  className="min-h-[120px]"
                />
              </div>
            </>
          )}

          {/* Step 4: Produtos/Serviços */}
          {currentStep === 4 && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Seus Produtos e Serviços</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione os produtos ou serviços que você oferece
                  </p>
                </div>
                <Button onClick={() => setShowProductForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {/* Form de Produto */}
              {showProductForm && (
                <Card className="border-primary">
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        {editingProduct ? "Editar Produto" : "Novo Produto/Serviço"}
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowProductForm(false);
                          setEditingProduct(null);
                          setProductForm({ name: "", description: "", price: "", category: "", duration: "", salesLink: "" });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-name">
                        Nome do Produto/Serviço <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="product-name"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="nome do produto"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="product-category">Categoria</Label>
                        <Input
                          id="product-category"
                          value={productForm.category}
                          onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                          placeholder="Ex: Serviço, Produto..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="product-price" className="flex items-center gap-1">
                          Preço
                          <CreditCard className="h-3 w-3 text-muted-foreground" />
                        </Label>
                        <Input
                          id="product-price"
                          value={productForm.price}
                          onChange={handlePriceChange}
                          placeholder="R$ 0,00"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="product-duration" className="flex items-center gap-1">
                          Duração
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        </Label>
                        <div className="relative">
                          <Input
                            id="product-duration"
                            type="number"
                            min="0"
                            value={productForm.duration}
                            onChange={(e) => setProductForm({ ...productForm, duration: e.target.value })}
                            placeholder="60"
                            className="pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            minutos
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-description">Descrição Detalhada</Label>
                      <Textarea
                        id="product-description"
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Descreva o produto ou serviço com detalhes: o que inclui, diferenciais, observações importantes..."
                        rows={4}
                        className="min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-salesLink" className="flex items-center gap-1">
                        Link de Venda
                        <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="product-salesLink"
                        type="url"
                        value={productForm.salesLink}
                        onChange={(e) => setProductForm({ ...productForm, salesLink: e.target.value })}
                        placeholder="https://seusite.com/checkout/produto"
                      />
                      <p className="text-xs text-muted-foreground">
                        Link de checkout ou página de compra. A IA usará esse link para direcionar o cliente na hora da venda.
                      </p>
                    </div>

                    <Button onClick={handleAddProduct} className="w-full">
                      {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Produtos - CORREÇÃO TELA BRANCA */}
              {Array.isArray(products) && products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {products.map((product) => (
                    <Card key={product.id} className="relative group hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Título e Categoria */}
                            <div className="flex items-start gap-2 mb-2">
                              <h4 className="font-semibold text-base flex-1">{product.name}</h4>
                              {product.category && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {product.category}
                                </Badge>
                              )}
                            </div>

                            {/* Preço, Duração e Link */}
                            <div className="flex flex-wrap gap-3 mb-2">
                              {product.price && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <CreditCard className="h-4 w-4 text-green-600" />
                                  <span className="font-semibold text-green-700 dark:text-green-400">
                                    {product.price}
                                  </span>
                                </div>
                              )}
                              {product.duration && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Clock className="h-4 w-4 text-blue-600" />
                                  <span className="text-muted-foreground">
                                    {product.duration} min {product.duration >= 60 && `(${Math.floor(product.duration / 60)}h${product.duration % 60 > 0 ? ` ${product.duration % 60}min` : ''})`}
                                  </span>
                                </div>
                              )}
                              {product.salesLink && (
                                <div className="flex items-center gap-1.5 text-sm">
                                  <ShoppingCart className="h-4 w-4 text-purple-600" />
                                  <span className="text-purple-600 dark:text-purple-400">Link de venda</span>
                                </div>
                              )}
                            </div>

                            {/* Descrição */}
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum produto adicionado ainda</p>
                  <p className="text-sm">Clique em "Adicionar" para começar</p>
                </div>
              )}
            </>
          )}

          {/* Step 5: Serviços com Variações */}
          {currentStep === 5 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium">Serviços com Variações de Preço</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure serviços com variáveis que modificam o preço final
                  </p>
                </div>
                <Button onClick={addService} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Serviço
                </Button>
              </div>

              {/* Info Card */}
              {/* <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Como funciona?</p>
                  <p>
                    Cadastre serviços com um <strong>preço base</strong> e adicione{" "}
                    <strong>variáveis</strong> que modificam o preço final. Por exemplo: uma
                    instalação de ar condicionado pode ter variáveis como BTUs, tipo de acesso
                    (escada/rapel) e região.
                  </p>
                </div>
              </div> */}

              {/* Lista de Serviços */}
              {services.length > 0 ? (
                <div className="space-y-4">
                  {services.map((service, serviceIndex) => (
                    <Card key={serviceIndex} className="overflow-hidden">
                      {/* Service Header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleServiceExpanded(serviceIndex)}
                      >
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-5 h-5 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <Input
                            value={service.name}
                            onChange={(e) => updateService(serviceIndex, "name", e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Nome do serviço (ex: Instalação de Ar Condicionado)"
                            className="text-lg font-semibold bg-transparent border-none focus:ring-0 p-0 h-auto"
                          />
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>Base: {formatServicePrice(service.basePrice)}</span>
                            <span>•</span>
                            <span>{service.variables.length} variáveis</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeService(serviceIndex);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>

                        {expandedServices.has(serviceIndex) ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Service Content (Expanded) */}
                      {expandedServices.has(serviceIndex) && (
                        <CardContent className="border-t space-y-6 pt-4">
                          {/* Basic Info */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Descrição (opcional)</Label>
                              <Input
                                value={service.description || ""}
                                onChange={(e) =>
                                  updateService(serviceIndex, "description", e.target.value)
                                }
                                placeholder="Breve descrição do serviço"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Categoria (opcional)</Label>
                              <Input
                                value={service.category || ""}
                                onChange={(e) =>
                                  updateService(serviceIndex, "category", e.target.value)
                                }
                                placeholder="Ex: Instalação, Limpeza, Manutenção"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1">
                                Duração
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="1"
                                  value={service.duration || 60}
                                  onChange={(e) =>
                                    updateService(serviceIndex, "duration", parseInt(e.target.value) || 60)
                                  }
                                  placeholder="60"
                                  className="pr-16"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  minutos
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Pricing Section */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="flex items-center gap-2 text-base">
                                <DollarSign className="w-4 h-4" />
                                Precificação
                              </Label>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-normal text-muted-foreground">
                                  Preço varia por quantidade?
                                </Label>
                                <Switch
                                  checked={service.usePricingTiers || false}
                                  onCheckedChange={() => toggleUsePricingTiers(serviceIndex)}
                                />
                              </div>
                            </div>

                            {!service.usePricingTiers ? (
                              /* Preço Base Simples */
                              <div className="space-y-2">
                                <Label className="text-sm">Preço Base (R$)</Label>
                                <div className="relative max-w-xs">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
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
                                    className="pl-9"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Preço fixo independente da quantidade
                                </p>
                              </div>
                            ) : (
                              /* Faixas de Preço por Quantidade */
                              <div className="space-y-3">
                                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                                  <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>Faixas de preço:</strong> Configure preços diferentes conforme a quantidade.
                                    Ex: 1 un = R$ 275, 2-4 un = R$ 250/cada, 5+ un = R$ 200/cada.
                                  </p>
                                </div>

                                {service.pricingTiers && service.pricingTiers.length > 0 && (
                                  <div className="space-y-2">
                                    {service.pricingTiers.map((tier, tierIndex) => (
                                      <div
                                        key={tierIndex}
                                        className="flex flex-wrap items-center gap-2 bg-muted/50 p-3 rounded-lg border"
                                      >
                                        <span className="text-sm text-muted-foreground">De</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={tier.minQuantity}
                                          onChange={(e) =>
                                            updatePricingTier(
                                              serviceIndex,
                                              tierIndex,
                                              "minQuantity",
                                              parseInt(e.target.value) || 1
                                            )
                                          }
                                          className="w-16 text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">até</span>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={tier.maxQuantity || ""}
                                          onChange={(e) =>
                                            updatePricingTier(
                                              serviceIndex,
                                              tierIndex,
                                              "maxQuantity",
                                              e.target.value ? parseInt(e.target.value) : null
                                            )
                                          }
                                          placeholder="+"
                                          className="w-16 text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">un.</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                        <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                            R$
                                          </span>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={tier.pricePerUnit}
                                            onChange={(e) =>
                                              updatePricingTier(
                                                serviceIndex,
                                                tierIndex,
                                                "pricePerUnit",
                                                parseFloat(e.target.value) || 0
                                              )
                                            }
                                            className="w-28 pl-8"
                                          />
                                        </div>
                                        <span className="text-sm text-muted-foreground">/cada</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removePricingTier(serviceIndex, tierIndex)}
                                          disabled={service.pricingTiers!.length <= 1}
                                          className="ml-auto text-muted-foreground hover:text-destructive disabled:opacity-30"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addPricingTier(serviceIndex)}
                                  className="w-full border-dashed"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar Faixa de Preço
                                </Button>

                                {/* Preview de cálculo */}
                                {service.pricingTiers && service.pricingTiers.length > 0 && (
                                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
                                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                                      Exemplo de cálculo:
                                    </p>
                                    <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                                      {service.pricingTiers.map((tier, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <Hash className="w-3 h-3" />
                                          <span>
                                            {tier.maxQuantity
                                              ? `${tier.minQuantity} a ${tier.maxQuantity} un.`
                                              : `${tier.minQuantity}+ un.`}
                                            {" "}: R$ {tier.pricePerUnit.toFixed(2)} cada
                                            {tier.minQuantity > 0 && (
                                              <span className="text-green-600 dark:text-green-400 ml-1">
                                                (ex: {tier.minQuantity} un. = R$ {(tier.pricePerUnit * tier.minQuantity).toFixed(2)})
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Variables Section */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Label className="flex items-center gap-2">
                                <Variable className="w-4 h-4" />
                                Variáveis de Preço
                              </Label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addVariable(serviceIndex)}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Adicionar Variável
                              </Button>
                            </div>

                            {service.variables.length === 0 ? (
                              <div className="text-center py-6 bg-muted/30 rounded-lg border-2 border-dashed">
                                <Variable className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  Nenhuma variável cadastrada
                                </p>
                                <Button
                                  variant="link"
                                  size="sm"
                                  onClick={() => addVariable(serviceIndex)}
                                >
                                  + Adicionar primeira variável
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {service.variables.map((variable, varIndex) => (
                                  <Card key={varIndex} className="bg-muted/30">
                                    <CardContent className="pt-4">
                                      {/* Variable Header */}
                                      <div className="flex items-start gap-3 mb-4">
                                        <div className="flex-1">
                                          <Input
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
                                            className="font-medium"
                                          />
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeVariable(serviceIndex, varIndex)}
                                          className="text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>

                                      {/* Options */}
                                      <div className="space-y-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                          Opções
                                        </span>

                                        {variable.options.map((option, optIndex) => (
                                          <div
                                            key={optIndex}
                                            className="flex items-center gap-2 bg-background rounded-lg p-2 border"
                                          >
                                            <Input
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
                                              className="flex-1"
                                            />
                                            <div className="relative w-32">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                R$
                                              </span>
                                              <Input
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
                                                className="pl-8 text-right"
                                              />
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                removeOption(serviceIndex, varIndex, optIndex)
                                              }
                                              disabled={variable.options.length <= 1}
                                              className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        ))}

                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => addOption(serviceIndex, varIndex)}
                                          className="w-full border-dashed"
                                        >
                                          + Adicionar opção
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Example Calculation */}
                          {service.variables.length > 0 && (
                            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                              <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                                Exemplo de cálculo
                              </h4>
                              <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
                                <div className="flex justify-between">
                                  <span>Preço base</span>
                                  <span>{formatServicePrice(service.basePrice)}</span>
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
                                          {formatServicePrice(variable.options[0].priceModifier)}
                                        </span>
                                      </div>
                                    )
                                )}
                                <div className="flex justify-between pt-2 border-t border-green-300 dark:border-green-700 font-semibold">
                                  <span>Total</span>
                                  <span>{formatServicePrice(calculateExamplePrice(service))}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum serviço com variações adicionado</p>
                  <p className="text-sm">Clique em "Adicionar Serviço" para começar</p>
                </div>
              )}
            </>
          )}

          {/* Step 6: Finalizar */}
          {currentStep === 6 && (
            <div className="text-center py-8">
              <Wand2 className="h-16 w-16 mx-auto text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Tudo pronto!</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Agora vamos gerar um contexto completo e otimizado para sua IA
                com base nas informações que você forneceu.
              </p>

              <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                <h4 className="font-medium mb-2">O que será gerado:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Contexto completo e estruturado
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Instruções otimizadas para atendimento
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Base de conhecimento pronta para uso
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleGenerateContext}
                disabled={generatingContext}
                size="lg"
                className="min-w-[200px]"
              >
                {generatingContext ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Gerar Contexto da IA
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep < 5 && (
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>

              <div className="flex gap-2">
                {/* Botão de Salvar (se já passou pelo setup antes) */}
                {setupCompleted && (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Salva serviços se houver algum
                      if (services.length > 0) {
                        await saveServices();
                      }
                      await saveKnowledge();
                      await handleGenerateContext();
                    }}
                    disabled={saving || generatingContext}
                  >
                    {saving || generatingContext ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Salvar e Regenerar
                  </Button>
                )}

                <Button onClick={handleNextStep} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de visão completa após setup
function CompletedView({
  companyName,
  companySegment,
  companyDescription,
  objectiveType,
  objectivePresets,
  aiObjective,
  workingHours,
  businessHoursStart,
  businessHoursEnd,
  paymentMethods,
  deliveryInfo,
  warrantyInfo,
  products,
  services,
  generatedContext,
  autoReplyEnabled,
  onEdit,
  onRegenerate,
  generatingContext,
  setAutoReplyEnabled,
  saveKnowledge,
}: {
  knowledge: AIKnowledge | null;
  companyName: string;
  companySegment: string;
  companyDescription: string;
  objectiveType: string;
  objectivePresets: ObjectivePreset[];
  aiObjective: string;
  workingHours: string;
  businessHoursStart: number;
  businessHoursEnd: number;
  paymentMethods: string;
  deliveryInfo: string;
  warrantyInfo: string;
  products: Product[];
  services: Service[];
  generatedContext: string;
  autoReplyEnabled: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  generatingContext: boolean;
  setAutoReplyEnabled: (value: boolean) => void;
  saveKnowledge: (nextStep?: number, overrides?: { autoReplyEnabled?: boolean }) => void;
}) {
  // Encontra o preset selecionado
  const selectedPreset = objectivePresets.find(p => p.id === objectiveType);
  const ObjectiveIcon = OBJECTIVE_ICONS[objectiveType] || Target;
  return (
    <div className="p-6 mx-auto space-y-6">
      {/* Toggle de Resposta Automática */}
      <Card>
        <CardContent className="py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="space-y-0.5">
              <Label className="text-base">Resposta Automática</Label>
              <p className="text-sm text-muted-foreground">
                Permite que a IA responda automaticamente mensagens dos clientes
              </p>
            </div>
            <Switch
              checked={autoReplyEnabled}
              onCheckedChange={(checked) => {
                setAutoReplyEnabled(checked);
                saveKnowledge(undefined, { autoReplyEnabled: checked });
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button onClick={onRegenerate} disabled={generatingContext}>
              {generatingContext ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-1" />
              )}
              Regenerar Contexto
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Empresa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Sua Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Nome:</span>
              <p className="font-medium">{companyName || "-"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Segmento:</span>
              <p className="font-medium">{companySegment || "-"}</p>
            </div>
            {companyDescription && (
              <div>
                <span className="text-sm text-muted-foreground">Descrição:</span>
                <p className="text-sm line-clamp-3">{companyDescription}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objetivo da IA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ObjectiveIcon className="h-5 w-5" />
              Objetivo da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <ObjectiveIcon className="h-3 w-3" />
                {selectedPreset?.label || "Suporte ao Cliente"}
              </Badge>
            </div>
            {selectedPreset?.description && (
              <p className="text-sm text-muted-foreground">
                {selectedPreset.description}
              </p>
            )}
            {objectiveType === "custom" && aiObjective && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Objetivo customizado:</span>
                <p className="text-sm line-clamp-3">{aiObjective}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Políticas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Políticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {String(businessHoursStart).padStart(2, '0')}:00 às {String(businessHoursEnd).padStart(2, '0')}:00
              </span>
            </div>
            {workingHours && (
              <div className="flex items-start gap-2 pl-6">
                <span className="text-sm text-muted-foreground">{workingHours}</span>
              </div>
            )}
            {paymentMethods && (
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{paymentMethods}</span>
              </div>
            )}
            {deliveryInfo && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm line-clamp-2">{deliveryInfo}</span>
              </div>
            )}
            {warrantyInfo && (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm line-clamp-2">{warrantyInfo}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produtos - CORREÇÃO TELA BRANCA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Produtos/Serviços
              <Badge variant="secondary" className="ml-auto">
                {Array.isArray(products) ? products.length : 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(products) && products.length > 0 ? (
              <div className="space-y-2">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="flex items-center justify-between text-sm">
                    <span>{product.name}</span>
                    {product.price && (
                      <span className="text-muted-foreground">{product.price}</span>
                    )}
                  </div>
                ))}
                {products.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{products.length - 4} mais...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
            )}
          </CardContent>
        </Card>

        {/* Serviços com Variações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5" />
              Serviços com Variações
              <Badge variant="secondary" className="ml-auto">
                {Array.isArray(services) ? services.length : 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(services) && services.length > 0 ? (
              <div className="space-y-2">
                {services.slice(0, 4).map((service, idx) => (
                  <div key={service.id || idx} className="flex items-center justify-between text-sm">
                    <span>{service.name}</span>
                    <span className="text-muted-foreground">
                      {service.basePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {service.variables.length > 0 && ` + ${service.variables.length} var.`}
                    </span>
                  </div>
                ))}
                {services.length > 4 && (
                  <p className="text-xs text-muted-foreground">
                    +{services.length - 4} mais...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum serviço com variações</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contexto Gerado */}
      {generatedContext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Contexto Gerado pela IA
            </CardTitle>
            <CardDescription>
              Este é o contexto que sua IA usa para responder os clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {generatedContext}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}