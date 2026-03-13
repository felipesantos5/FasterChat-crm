"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Plus,
  Trash2,
  Edit3,
  X,
  Wand2,
  Clock,
  CreditCard,
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
  HeartHandshake,
  MessageSquare,
  Database,
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
  consultative_attentive: HeartHandshake,
  sales_scheduling: CalendarCheck,
  scheduling_only: Calendar,
  info_faq: Info,
  lead_qualification: UserCheck,
  order_tracking: PackageSearch,
  custom: Settings,
};

// Definição dos steps do wizard

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
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Campos do formulário
  const [companyName, setCompanyName] = useState("");
  const [companySegment, setCompanySegment] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  const [objectiveType, setObjectiveType] = useState("support");
  const [objectivePresets, setObjectivePresets] = useState<ObjectivePreset[]>([]);
  const [aiObjective, setAiObjective] = useState(""); // Usado apenas quando objectiveType === 'custom'

  // Configurações avançadas do objetivo
  const [aiTone, setAiTone] = useState<string>("professional");
  const [aiProactivity, setAiProactivity] = useState<string>("medium");
  const [aiClosingFocus, setAiClosingFocus] = useState<boolean>(false);
  const [aiShowPrices, setAiShowPrices] = useState<boolean>(false);
  const [aiCustomInstructions, setAiCustomInstructions] = useState("");
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(true);

  const [workingHours, setWorkingHours] = useState("");
  const [businessHoursStart, setBusinessHoursStart] = useState<number>(9);
  const [businessHoursEnd, setBusinessHoursEnd] = useState<number>(18);
  const [paymentMethods, setPaymentMethods] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [warrantyInfo, setWarrantyInfo] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [replyDelay, setReplyDelay] = useState<number>(10);

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
        pricingTiers:
          s.pricingTiers?.map((t: any) => ({
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

        // Carregar configurações avançadas
        setAiTone(response.data.aiTone || "professional");
        setAiProactivity(response.data.aiProactivity || "medium");
        setAiClosingFocus(response.data.aiClosingFocus ?? false);
        setAiCustomInstructions(response.data.aiCustomInstructions || "");
        setAiShowPrices(response.data.aiShowPrices ?? false);

        // Expandir seção avançada se houver dados
        setShowAdvancedConfig(true);

        setWorkingHours(response.data.workingHours || "");
        setBusinessHoursStart(response.data.businessHoursStart ?? 9);
        setBusinessHoursEnd(response.data.businessHoursEnd ?? 18);
        setPaymentMethods(response.data.paymentMethods || "");
        setDeliveryInfo(response.data.deliveryInfo || "");
        setWarrantyInfo(response.data.warrantyInfo || "");

        // CORREÇÃO DA TELA BRANCA: Garante que products é sempre um array
        setProducts(Array.isArray(response.data.products) ? response.data.products : []);

        setAutoReplyEnabled(response.data.autoReplyEnabled ?? true);
        setReplyDelay(response.data.replyDelay ?? 10);
        setSetupCompleted(response.data.setupCompleted ?? false);
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
        aiObjective: objectiveType === "custom" ? aiObjective : undefined,
        aiTone,
        aiProactivity,
        aiClosingFocus,
        aiCustomInstructions,
        aiShowPrices,
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
        replyDelay: replyDelay,
        setupStep: nextStep ?? 0,
        setupCompleted,
      });

      toast.success("Configurações salvas!");
    } catch (err: any) {
      console.error("Error saving:", err);
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message;
      if (code === 'PLAN_RESTRICTION') {
        toast.error("Recurso indisponível no seu plano", { description: message || "Faça upgrade para ativar a resposta automática." });
      } else if (code === 'PERMISSION_DENIED') {
        toast.error("Sem permissão", { description: message || "Solicite acesso ao administrador." });
      } else if (code === 'SUBSCRIPTION_INACTIVE') {
        toast.error("Assinatura inativa", { description: message || "Regularize seu pagamento para continuar." });
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } finally {
      setSaving(false);
    }
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
          aiObjective: objectiveType === "custom" ? aiObjective : undefined,
          workingHours,
          businessHoursStart,
          businessHoursEnd,
          paymentMethods,
          deliveryInfo,
          warrantyInfo,
          products, // <--- OBRIGATÓRIO PARA NÃO APAGAR OS PRODUTOS
          faq: knowledge?.faq || undefined, // Preserva FAQ
          autoReplyEnabled,
          replyDelay,
          setupStep: 4,
          setupCompleted: true, // Força o status de completo
        });

        toast.success("Contexto gerado com sucesso! Sua IA está pronta para atender.");
      }
    } catch (err: any) {
      console.error("Error generating context:", err);
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message;
      if (code === 'PLAN_RESTRICTION') {
        toast.error("Recurso indisponível no seu plano", { description: message || "Faça upgrade para ativar a resposta automática." });
      } else if (code === 'PERMISSION_DENIED') {
        toast.error("Sem permissão", { description: message || "Solicite acesso ao administrador." });
      } else if (code === 'SUBSCRIPTION_INACTIVE') {
        toast.error("Assinatura inativa", { description: message || "Regularize seu pagamento para continuar." });
      } else {
        toast.error("Erro ao gerar contexto. Tente novamente.");
      }
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
      setProducts(products.map((p) => (p.id === editingProduct.id ? newProduct : p)));
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
    const updatedProducts = products.filter((p) => p.id !== productId);
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
    updated[serviceIndex].variables = updated[serviceIndex].variables.filter((_, i) => i !== varIndex);
    setServices(updated);
  };

  const updateVariable = (serviceIndex: number, varIndex: number, field: keyof ServiceVariable, value: any) => {
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
    updated[serviceIndex].variables[varIndex].options = updated[serviceIndex].variables[varIndex].options.filter((_, i) => i !== optIndex);
    setServices(updated);
  };

  const updateOption = (serviceIndex: number, varIndex: number, optIndex: number, field: keyof ServiceOption, value: any) => {
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
      updated[serviceIndex].pricingTiers = [{ minQuantity: 1, maxQuantity: 1, pricePerUnit: updated[serviceIndex].basePrice || 0 }];
    }
    setServices(updated);
  };

  const addPricingTier = (serviceIndex: number) => {
    const updated = [...services];
    const tiers = updated[serviceIndex].pricingTiers || [];
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier ? (lastTier.maxQuantity || lastTier.minQuantity) + 1 : 1;

    updated[serviceIndex].pricingTiers = [...tiers, { minQuantity: newMin, maxQuantity: null, pricePerUnit: 0 }];
    setServices(updated);
  };

  const removePricingTier = (serviceIndex: number, tierIndex: number) => {
    const updated = [...services];
    updated[serviceIndex].pricingTiers = updated[serviceIndex].pricingTiers?.filter((_, i) => i !== tierIndex) || [];
    setServices(updated);
  };

  const updatePricingTier = (serviceIndex: number, tierIndex: number, field: keyof PricingTier, value: any) => {
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
            toast.error(`Todas as opções da variável "${variable.name}" precisam ter um nome`);
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
              tiers: service.pricingTiers.map((tier) => ({
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

  const formatBRL = (value: number | string | undefined | null) => {
    if (!value && value !== 0) return "R$ 0,00";
    if (typeof value === 'string') return value;
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatServicePrice = (price: number) => {
    return price === 0 ? "Sob consulta" : formatBRL(price);
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

  if (setupCompleted) {
    return (
      <CompletedView
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
        autoReplyEnabled={autoReplyEnabled}
        replyDelay={replyDelay}
        onEdit={() => setSetupCompleted(false)}
        onRegenerate={handleGenerateContext}
        generatingContext={generatingContext}
        setAutoReplyEnabled={setAutoReplyEnabled}
        saveKnowledge={saveKnowledge}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações da IA</h1>
          <p className="text-muted-foreground">Personalize a identidade, regras e o catálogo do seu assistente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadKnowledge()} disabled={loading}>
            Descartar Alterações
          </Button>
          <Button
            onClick={async () => {
              if (services.length > 0) await saveServices();
              await saveKnowledge();
              await handleGenerateContext();
            }}
            disabled={saving || generatingContext}
            className="shadow-lg shadow-primary/20"
          >
            {saving || generatingContext ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Salvar e Publicar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Coluna Esquerda: Configurações */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 h-12 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="identity" className="rounded-lg data-[state=active]:shadow-sm">
                <Target className="h-4 w-4 mr-2" />
                Identidade
              </TabsTrigger>
              <TabsTrigger value="policies" className="rounded-lg data-[state=active]:shadow-sm">
                <FileText className="h-4 w-4 mr-2" />
                Operação
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:shadow-sm">
                <Package className="h-4 w-4 mr-2" />
                Catálogo
              </TabsTrigger>
            </TabsList>

            {/* ABA: IDENTIDADE E COMPORTAMENTO */}
            <TabsContent value="identity" className="space-y-6 pt-2 animate-in fade-in slide-in-from-left-4 duration-300">
              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-black">
                    <Target className="h-6 w-6 text-primary" />
                    Missão da IA
                  </CardTitle>
                  <CardDescription className="text-base">Escolha o objetivo principal que guiará todas as conversas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {objectivePresets.map((preset) => {
                      const Icon = OBJECTIVE_ICONS[preset.id] || Target;
                      return (
                        <button
                          type="button"
                          key={preset.id}
                          onClick={() => setObjectiveType(preset.id)}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
                            objectiveType === preset.id ? "border-primary bg-primary/5 shadow-inner" : "border-muted hover:bg-muted/30",
                          )}
                        >
                          <div className={cn(
                            "p-3 rounded-xl shrink-0 transition-colors",
                            objectiveType === preset.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground",
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm leading-tight">{preset.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed opacity-80">{preset.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {objectiveType === "custom" && (
                    <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-4">
                      <Label htmlFor="aiObjective" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Instruções Customizadas</Label>
                      <Textarea
                        id="aiObjective"
                        value={aiObjective}
                        onChange={(e) => setAiObjective(e.target.value)}
                        placeholder="Ex: Você é um assistente de vendas de carros de luxo..."
                        rows={6}
                        className="bg-muted/10 border-2 rounded-xl focus:ring-primary shadow-inner text-base"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5">
                <CardHeader>
                  <CardTitle className="text-xl font-black">Personalidade & Persona</CardTitle>
                  <CardDescription>Ajuste o tom e o nível de autonomia do assistente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <Label className="font-bold">Tom de Voz</Label>
                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value)}
                        className="flex h-12 w-full rounded-xl border-2 border-input bg-background px-4 text-sm font-medium transition-colors focus:border-primary focus:ring-0"
                      >
                        <option value="professional">🤵 Profissional (Sério e Educado)</option>
                        <option value="friendly">😊 Amigável (Acolhedor e Próximo)</option>
                        <option value="casual">👋 Casual (Descontraído e Leve)</option>
                        <option value="formal">👔 Formal (Rígido e Respeitoso)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <Label className="font-bold">Proatividade</Label>
                      <select
                        value={aiProactivity}
                        onChange={(e) => setAiProactivity(e.target.value)}
                        className="flex h-12 w-full rounded-xl border-2 border-input bg-background px-4 text-sm font-medium transition-colors focus:border-primary focus:ring-0"
                      >
                        <option value="low">🔇 Baixa (Reativo: Só responde o que perguntar)</option>
                        <option value="medium">⚖️ Média (Equilibrado: Sugere extras)</option>
                        <option value="high">🚀 Alta (Vendedor: Conduz o fechamento)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl border-2 bg-muted/5 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-base font-bold">Foco em Vendas</Label>
                        <p className="text-xs text-muted-foreground leading-tight">Priorizar a conversão em cada resposta</p>
                      </div>
                      <Switch checked={aiClosingFocus} onCheckedChange={setAiClosingFocus} />
                    </div>

                    <div className="flex items-center justify-between p-5 rounded-2xl border-2 bg-muted/5 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1">
                        <Label className="text-base font-bold">Transparência de Preços</Label>
                        <p className="text-xs text-muted-foreground leading-tight">Citar valores de forma proativa na conversa</p>
                      </div>
                      <Switch checked={aiShowPrices} onCheckedChange={setAiShowPrices} />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="flex items-center gap-2 font-bold">
                       <Sparkles className="h-4 w-4 text-primary" />
                       Expert: Instruções de Rodapé
                    </Label>
                    <Textarea
                      value={aiCustomInstructions}
                      onChange={(e) => setAiCustomInstructions(e.target.value)}
                      placeholder="Ex: Nunca use o emoji de foguete | Chame o cliente de 'você' | Se perguntarem do dono, diga que ele não está disponível."
                      className="min-h-[140px] bg-muted/5 border-dashed border-2 rounded-xl font-mono text-xs p-4 leading-relaxed"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: POLÍTICAS E OPERAÇÃO */}
            <TabsContent value="policies" className="space-y-6 pt-2 animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
                <CardHeader className="bg-primary/[0.02] border-b border-primary/5">
                  <CardTitle className="flex items-center gap-2 text-xl font-black">
                    <Building2 className="h-6 w-6 text-primary" />
                    Sobre o Negócio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="companyName" className="font-bold">Nome Público da Empresa</Label>
                      <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11 border-2 rounded-xl px-4" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companySegment" className="font-bold">Segmento Principal</Label>
                      <select
                        value={companySegment}
                        onChange={(e) => setCompanySegment(e.target.value)}
                        className="flex h-11 w-full rounded-xl border-2 border-input bg-background px-4 text-sm font-medium"
                      >
                        {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="companyDescription" className="font-bold">Apresentação da Empresa (Visão IA)</Label>
                    <Textarea
                      id="companyDescription"
                      value={companyDescription}
                      onChange={(e) => setCompanyDescription(e.target.value)}
                      placeholder="Conte sobre sua história, especialidades e o que torna seu serviço único..."
                      className="min-h-[150px] border-2 rounded-xl leading-relaxed text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-black text-primary">
                    <Clock className="h-6 w-6" />
                    Regras de Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <Label className="text-base font-bold flex items-center gap-2">
                           <Clock className="h-4 w-4 text-muted-foreground" />
                           Janela Comercial
                        </Label>
                        <div className="grid grid-cols-2 gap-3 items-center">
                           <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Início</p>
                              <select value={businessHoursStart} onChange={(e) => setBusinessHoursStart(parseInt(e.target.value))} className="w-full h-11 border-2 rounded-xl px-2 font-bold">
                                 {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                              </select>
                           </div>
                           <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Fim</p>
                              <select value={businessHoursEnd} onChange={(e) => setBusinessHoursEnd(parseInt(e.target.value))} className="w-full h-11 border-2 rounded-xl px-2 font-bold">
                                 {Array.from({length: 24}).map((_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                              </select>
                           </div>
                        </div>
                        <Input
                          value={workingHours}
                          onChange={(e) => setWorkingHours(e.target.value)}
                          placeholder="Ex: Seg a Sex 09h-18h, Sáb 09h-13h"
                        />
                     </div>

                     <div className="space-y-4">
                        <Label className="text-base font-bold flex items-center gap-2 text-muted-foreground">
                           <CreditCard className="h-4 w-4" />
                           Pagamento & Venda
                        </Label>
                        <Textarea
                          value={paymentMethods}
                          onChange={(e) => setPaymentMethods(e.target.value)}
                          placeholder="Ex: Pix com 5% desc | Crédito 12x | Débito presencial..."
                          className="min-h-[100px] border-2 rounded-xl text-sm"
                        />
                     </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA: CATÁLOGO E INVENTÁRIO */}
            <TabsContent value="inventory" className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-primary/[0.02]">
                  <div>
                    <CardTitle className="text-2xl font-black">Produtos e Itens</CardTitle>
                    <CardDescription className="text-base">Gerencie o portfólio de produtos individuais.</CardDescription>
                  </div>
                  <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingProduct(null); setProductForm({name: "", description: "", price: "", category: "", duration: "", salesLink: ""}); }} className="rounded-xl shadow-lg shadow-primary/20">
                        <Plus className="h-5 w-5 mr-1" /> Novo Produto
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
                       <div className="p-8 bg-background">
                          <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl font-black">{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                            <DialogDescription>Insira as informações do produto para a IA.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                             <div className="space-y-2">
                               <Label className="font-bold">Nome do Produto</Label>
                               <Input placeholder="Ex: Cadeira Gamer Pro" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} className="h-11 rounded-xl" />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <Label className="font-bold">Preço</Label>
                                 <Input placeholder="R$ 0,00" value={productForm.price} onChange={handlePriceChange} className="h-11 rounded-xl" />
                               </div>
                               <div className="space-y-2">
                                 <Label className="font-bold">Categoria</Label>
                                 <Input placeholder="Ex: Hardware" value={productForm.category} onChange={(e) => setProductForm({...productForm, category: e.target.value})} className="h-11 rounded-xl" />
                               </div>
                             </div>
                             <div className="space-y-2">
                               <Label className="font-bold">Descrição</Label>
                               <Textarea placeholder="Descreva os benefícios e características..." value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} rows={3} className="rounded-xl" />
                             </div>
                             <div className="space-y-2">
                               <Label className="font-bold">Link de Venda (Opcional)</Label>
                               <Input placeholder="https://..." value={productForm.salesLink} onChange={(e) => setProductForm({...productForm, salesLink: e.target.value})} className="h-11 rounded-xl" />
                             </div>
                             <Button onClick={handleAddProduct} className="w-full h-12 rounded-xl text-lg font-bold mt-4">
                               {editingProduct ? "Salvar Alterações" : "Adicionar ao Catálogo"}
                             </Button>
                          </div>
                       </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="pt-6">
                  {products.length > 0 ? (
                    <div className="rounded-2xl border-2 border-primary/5 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-bold">Item</TableHead>
                            <TableHead className="font-bold">Categoria</TableHead>
                            <TableHead className="font-bold">Valor</TableHead>
                            <TableHead className="text-right font-bold">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((product) => (
                            <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell className="font-bold py-4">{product.name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-md font-medium">{product.category || "Geral"}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-green-600 font-black">{product.price}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                   <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)} className="hover:bg-primary/10 hover:text-primary"><Edit3 className="h-4 w-4" /></Button>
                                   <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-3xl bg-muted/5 opacity-50">
                      <Package className="h-12 w-12 mb-3 text-muted-foreground" />
                      <p className="font-bold">Nenhum produto cadastrado</p>
                      <p className="text-sm">Clique em "Novo Produto" para começar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-blue-500/[0.02]">
                  <div>
                    <CardTitle className="text-2xl font-black">Serviços com Variações</CardTitle>
                    <CardDescription className="text-base">Configure serviços que dependem de variáveis (ex: instalação, consultoria).</CardDescription>
                  </div>
                  <Button onClick={addService} variant="outline" className="border-2 rounded-xl group hover:border-blue-500 transition-all">
                    <Plus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                    Adicionar Serviço
                  </Button>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {services.length > 0 ? (
                    <div className="space-y-4">
                      {services.map((service, serviceIndex) => (
                        <Card key={serviceIndex} className={cn(
                          "border-2 transition-all overflow-hidden rounded-2xl",
                          expandedServices.has(serviceIndex) ? "border-primary/20 shadow-md" : "border-muted hover:border-primary/10"
                        )}>
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors"
                            onClick={() => toggleServiceExpanded(serviceIndex)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Wrench className="h-5 w-5 text-blue-500" />
                              </div>
                              <div>
                                <h4 className="font-bold">{service.name || "Serviço sem nome"}</h4>
                                <p className="text-xs text-muted-foreground">{service.category || "Sem categoria"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-blue-600 font-bold">
                                {service.usePricingTiers ? "Preço p/ Faixa" : formatServicePrice(service.basePrice)}
                              </Badge>
                              {expandedServices.has(serviceIndex) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); removeService(serviceIndex); }}
                                className="text-destructive hover:bg-destructive/10 h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {expandedServices.has(serviceIndex) && (
                            <CardContent className="p-6 space-y-8 animate-in slide-in-from-top-2 duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <Label className="font-bold">Nome do Serviço</Label>
                                  <Input
                                    value={service.name}
                                    onChange={(e) => updateService(serviceIndex, "name", e.target.value)}
                                    placeholder="Ex: Instalação de Ar Condicionado"
                                    className="rounded-xl border-2"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-bold">Duração Estimada</Label>
                                  <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      value={service.duration}
                                      onChange={(e) => updateService(serviceIndex, "duration", parseInt(e.target.value) || 0)}
                                      className="pl-10 rounded-xl border-2"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground uppercase font-bold">min</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2 text-base font-bold">
                                    <DollarSign className="w-5 h-5 text-green-500" />
                                    Configuração de Preço
                                  </Label>
                                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full border">
                                    <Label className="text-xs font-bold text-muted-foreground">Preço por quantidade?</Label>
                                    <Switch checked={service.usePricingTiers || false} onCheckedChange={() => toggleUsePricingTiers(serviceIndex)} />
                                  </div>
                                </div>

                                {!service.usePricingTiers ? (
                                  <div className="p-4 bg-muted/10 rounded-2xl border-2 border-dashed space-y-2">
                                    <Label className="text-sm font-bold text-muted-foreground uppercase">Preço Base Fixo</Label>
                                    <div className="relative max-w-[200px]">
                                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={service.basePrice}
                                        onChange={(e) => updateService(serviceIndex, "basePrice", parseFloat(e.target.value) || 0)}
                                        className="pl-9 font-black text-lg h-12 rounded-xl border-2"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="grid gap-3">
                                      {service.pricingTiers?.map((tier, tierIndex) => (
                                        <div key={tierIndex} className="flex flex-wrap items-center gap-4 bg-background p-4 rounded-xl border-2 shadow-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-muted-foreground">DE</span>
                                            <Input type="number" value={tier.minQuantity} onChange={(e) => updatePricingTier(serviceIndex, tierIndex, "minQuantity", parseInt(e.target.value) || 1)} className="w-16 h-9 rounded-lg" />
                                            <span className="text-xs font-bold text-muted-foreground">ATÉ</span>
                                            <Input type="number" placeholder="∞" value={tier.maxQuantity || ""} onChange={(e) => updatePricingTier(serviceIndex, tierIndex, "maxQuantity", e.target.value ? parseInt(e.target.value) : null)} className="w-16 h-9 rounded-lg" />
                                          </div>
                                          <div className="flex items-center gap-2 ml-auto">
                                            <span className="text-xs font-bold text-muted-foreground uppercase">R$/UN</span>
                                            <Input type="number" step="0.01" value={tier.pricePerUnit} onChange={(e) => updatePricingTier(serviceIndex, tierIndex, "pricePerUnit", parseFloat(e.target.value) || 0)} className="w-28 h-9 rounded-lg font-bold" />
                                            <Button variant="ghost" size="icon" onClick={() => removePricingTier(serviceIndex, tierIndex)} className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => addPricingTier(serviceIndex)} className="w-full border-dashed h-10 rounded-xl">
                                      <Plus className="w-4 h-4 mr-2" /> Nova Faixa de Preço
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4 pt-4 border-t-2 border-dashed">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2 text-base font-bold">
                                    <Variable className="w-5 h-5 text-blue-500" />
                                    Variações customizadas
                                  </Label>
                                  <Button variant="ghost" size="sm" onClick={() => addVariable(serviceIndex)} className="text-blue-500 hover:bg-blue-50">
                                    <Plus className="w-4 h-4 mr-1" /> Adicionar Variável
                                  </Button>
                                </div>

                                {service.variables.length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {service.variables.map((variable, varIndex) => (
                                      <Card key={varIndex} className="bg-muted/5 border-2 rounded-2xl overflow-hidden">
                                        <div className="p-3 bg-muted/10 border-b-2 flex items-center justify-between">
                                          <Input
                                            value={variable.name}
                                            onChange={(e) => updateVariable(serviceIndex, varIndex, "name", e.target.value)}
                                            placeholder="Nome (ex: Material, Tamanho)"
                                            className="h-8 border-none bg-transparent font-bold focus-visible:ring-0 p-0"
                                          />
                                          <Button variant="ghost" size="icon" onClick={() => removeVariable(serviceIndex, varIndex)} className="h-6 w-6 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></Button>
                                        </div>
                                        <div className="p-3 space-y-2">
                                          {variable.options.map((option, optIndex) => (
                                            <div key={optIndex} className="flex items-center gap-2">
                                              <Input value={option.name} onChange={(e) => updateOption(serviceIndex, varIndex, optIndex, "name", e.target.value)} placeholder="Opção" className="h-8 rounded-lg text-xs" />
                                              <div className="relative w-24 shrink-0">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                                                <Input type="number" step="0.01" value={option.priceModifier} onChange={(e) => updateOption(serviceIndex, varIndex, optIndex, "priceModifier", parseFloat(e.target.value) || 0)} className="h-8 pl-6 pr-1 text-right rounded-lg text-xs font-bold" />
                                              </div>
                                              <Button variant="ghost" size="icon" onClick={() => removeOption(serviceIndex, varIndex, optIndex)} className="h-7 w-7 text-muted-foreground"><Trash2 className="h-3 w-3" /></Button>
                                            </div>
                                          ))}
                                          <Button variant="link" size="sm" onClick={() => addOption(serviceIndex, varIndex)} className="h-6 text-[10px] p-0">+ Adicionar Opção</Button>
                                        </div>
                                      </Card>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-muted/5 border-2 border-dashed rounded-3xl opacity-50">
                      <Wrench className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-bold">Nenhum serviço complexo adicionado</p>
                      <p className="text-sm">Ideal para serviços que variam de preço conforme o cenário.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Coluna Direita: Persona Preview (Sticky) */}
        <div className="lg:col-span-4 lg:sticky lg:top-8">
          <Card className="border-2 border-primary/15 shadow-2xl bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden rounded-[2rem] relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            </div>

            <CardHeader className="bg-primary/[0.03] border-b border-primary/10 pb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black">Persona Ativa</CardTitle>
                  <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase opacity-70">Visualização em Tempo Real</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors uppercase text-[10px] font-black tracking-widest px-3 py-1">
                  {setupCompleted ? "Publicada" : "Em Rascunho"}
                </Badge>
                <Badge variant="outline" className="border-muted-foreground/20 text-muted-foreground uppercase text-[10px] font-bold px-3 py-1">
                  v{knowledge?.id?.slice(-4) || '1.0'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-8 space-y-8">
               <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-muted/40 rounded-2xl border border-muted-foreground/10 space-y-1 group hover:border-primary/30 transition-colors">
                      <p className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest">Tom de Voz</p>
                      <p className="text-sm font-black capitalize flex items-center gap-2">
                        {aiTone === 'professional' && '🤵 Profissional'}
                        {aiTone === 'friendly' && '😊 Amigável'}
                        {aiTone === 'casual' && '👋 Casual'}
                        {aiTone === 'formal' && '👔 Formal'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/40 rounded-2xl border border-muted-foreground/10 space-y-1 group hover:border-primary/30 transition-colors">
                      <p className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest">Iniciativa</p>
                      <p className="text-sm font-black capitalize flex items-center gap-2">
                        {aiProactivity === 'low' && '🔇 Reativo'}
                        {aiProactivity === 'medium' && '⚖️ Equilibrado'}
                        {aiProactivity === 'high' && '🚀 Vendedor'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground/70 tracking-widest ml-1">Missão do Assistente</p>
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                      <div className="relative p-5 bg-background border border-primary/10 rounded-2xl italic text-xs leading-relaxed text-muted-foreground shadow-inner">
                        "{objectiveType === 'custom' ? (aiObjective || 'Aguardando definição da missão customizada...') : objectivePresets.find(p => p.id === objectiveType)?.description}"
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-dashed space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">Catálogo:</span>
                      </div>
                      <span className="text-xs font-black">{products.length + services.length} itens</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">Operação:</span>
                      </div>
                      <span className="text-xs font-black">{businessHoursStart}:00 - {businessHoursEnd}:00</span>
                    </div>
                  </div>
               </div>
            </CardContent>

            <CardFooter className="bg-primary/[0.02] border-t border-primary/5 p-8">
              <div className="w-full space-y-4">
                 <div className="flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sincronização</span>
                   <span className="text-[10px] font-black text-green-500 flex items-center gap-1">
                     <Check className="h-3 w-3" /> PRONTO
                   </span>
                 </div>
                 <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: '100%' }}></div>
                 </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Componente de visão completa após setup
function CompletedView({
  knowledge,
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
  autoReplyEnabled,
  replyDelay,
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
  autoReplyEnabled: boolean;
  replyDelay: number;
  onEdit: () => void;
  onRegenerate: () => void;
  generatingContext: boolean;
  setAutoReplyEnabled: (value: boolean) => void;
  saveKnowledge: (nextStep?: number, overrides?: { autoReplyEnabled?: boolean }) => void;
}) {
  // Encontra o preset selecionado
  const selectedPreset = objectivePresets.find((p) => p.id === objectiveType);
  const ObjectiveIcon = OBJECTIVE_ICONS[objectiveType] || Target;
  const isFreePlan = knowledge?.plan === "FREE" || knowledge?.plan === "INICIAL";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-background/50">
      {/* Header com Status Principal */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight">{companyName || "Painel de Controle da IA"}</h1>
            <Badge variant={autoReplyEnabled ? "default" : "secondary"} className={cn(
              "px-3 py-1 text-xs font-bold uppercase tracking-wider",
              autoReplyEnabled ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20" : "bg-neutral-500/10 text-neutral-500"
            )}>
              {autoReplyEnabled ? "Online" : "Offline"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">{companySegment || "Inteligência Artificial"} • Visão geral da operação.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={onEdit} className="shadow-sm border-2">
            <Edit3 className="h-5 w-5 mr-2" />
            Editar Configurações
          </Button>
          <Button size="lg" onClick={onRegenerate} disabled={generatingContext || isFreePlan} className="shadow-lg bg-primary hover:bg-primary/90">
            {generatingContext ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Wand2 className="h-5 w-5 mr-2" />}
            Regenerar Contexto
          </Button>
        </div>
      </div>

      {/* Bento Grid Styling */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Card 1: Status & Quick Controls (Span 4) */}
        <Card className="md:col-span-4 border-primary/10 shadow-xl shadow-primary/5 bg-gradient-to-br from-background to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Operação em Tempo Real
            </CardTitle>
            <CardDescription>Controle o comportamento ativo da sua IA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-background/60 backdrop-blur rounded-xl border border-primary/10 transition-all hover:border-primary/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Resposta Automática</Label>
                  <p className="text-[10px] text-muted-foreground">IA responde as primeiras mensagens</p>
                </div>
                <Switch
                  checked={isFreePlan ? false : autoReplyEnabled}
                  onCheckedChange={(checked) => {
                    if (isFreePlan) {
                      toast.error("Upgrade necessário");
                      return;
                    }
                    setAutoReplyEnabled(checked);
                    saveKnowledge(undefined, { autoReplyEnabled: checked });
                  }}
                  disabled={isFreePlan}
                />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-background/40">
                   <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Delay</p>
                   <p className="text-2xl font-black text-primary">{replyDelay}s</p>
                </div>
                <div className="p-4 rounded-xl border bg-background/40">
                   <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest mb-1">Plano</p>
                   <p className="text-sm font-black truncate">{knowledge?.plan || 'STARTUP'}</p>
                </div>
             </div>
          </CardContent>
          <CardFooter>
            {isFreePlan && (
              <div className="w-full flex items-center gap-2 p-2 bg-amber-500/10 text-amber-600 rounded-lg text-xs font-medium">
                <Shield className="h-4 w-4" />
                No plano Grátis, a Resposta Automática simula o atendimento mas não envia.
              </div>
            )}
          </CardFooter>
        </Card>

        {/* Card 2: Persona Summary (Span 4) */}
        <Card className="md:col-span-4 border-2 border-primary/5 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ObjectiveIcon className="h-5 w-5 text-primary" />
              Persona & Tom
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Badge variant="outline" className="text-primary font-bold uppercase">{selectedPreset?.label}</Badge>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "{objectiveType === 'custom' ? aiObjective : (selectedPreset?.description || "Atendimento configurado para as necessidades do seu negócio.")}"
              </p>
              {companyDescription && (
                <div className="mt-4 p-4 bg-muted/20 rounded-xl border-l-4 border-primary/20">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Sobre a Empresa</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{companyDescription}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Tom de Voz:</span>
                <Badge variant="secondary" className="capitalize">{(knowledge as any)?.aiTone || 'Profissional'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Proatividade:</span>
                <Badge variant="secondary" className="capitalize">{(knowledge as any)?.aiProactivity || 'Média'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Metrics & Inventory (Span 4) */}
        <Card className="md:col-span-4 border-2 border-primary/5 shadow-lg overflow-hidden">
           <CardHeader>
              <CardTitle className="text-xl">Inventário Ativo</CardTitle>
              <CardDescription>Produtos e serviços que a IA conhece.</CardDescription>
           </CardHeader>
           <CardContent className="p-0">
             <div className="grid grid-cols-2 divide-x border-y">
                <div className="p-6 text-center transition-colors hover:bg-muted/30">
                   <div className="text-4xl font-black mb-1">{products?.length || 0}</div>
                   <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Produtos</div>
                </div>
                <div className="p-6 text-center transition-colors hover:bg-muted/30">
                   <div className="text-4xl font-black mb-1">{services?.length || 0}</div>
                   <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Serviços</div>
                </div>
             </div>
             <div className="p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Destaques do Catálogo</p>
                {products?.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-0">
                    <span className="truncate max-w-[140px] font-medium">{p.name}</span>
                    <span className="text-primary font-bold">{p.price || '--'}</span>
                  </div>
                ))}
             </div>
           </CardContent>
        </Card>

        {/* Card 4: Operação & Horários (Span 5) */}
        <Card className="md:col-span-5 border-2 border-primary/5 shadow-lg">
           <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                 <Clock className="h-5 w-5 text-primary" />
                 Regras de Operação
              </CardTitle>
           </CardHeader>
           <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                 <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Horário Comercial</p>
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-lg font-black">{String(businessHoursStart).padStart(2, '0')}:00 - {String(businessHoursEnd).padStart(2, '0')}:00</p>
                 </div>
                 <p className="text-[11px] text-muted-foreground">{workingHours || 'Atendimento padrão configurado.'}</p>
              </div>
              <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pagamentos Aceitos</p>
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{paymentMethods || 'PIX, Cartão'}</span>
                     </div>
                  </div>
               </div>
               {deliveryInfo && (
                 <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Entrega/Logística</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{deliveryInfo}</p>
                 </div>
               )}
               {warrantyInfo && (
                 <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Garantia & Trocas</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{warrantyInfo}</p>
                 </div>
               )}
            </CardContent>
        </Card>

        {/* Card 5: Context Preview (Span 7) */}
        <Card className="md:col-span-7 border-2 border-primary/5 shadow-lg bg-neutral-900 text-neutral-100 overflow-hidden">
           <CardHeader className="border-b border-neutral-800 bg-neutral-950/50">
              <div className="flex items-center justify-between">
                 <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-400" />
                    Cérebro da IA (Contexto Gerado)
                 </CardTitle>
                 <Badge variant="outline" className="border-neutral-700 text-neutral-400 text-[10px]">
                    v{knowledge?.id?.slice(-4) || '1.0'}
                 </Badge>
              </div>
           </CardHeader>
           <CardContent className="p-0">
              <div className="p-4 h-[200px] overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-neutral-700">
                 {knowledge?.generatedContext ? (
                    <div className="space-y-2">
                       {knowledge.generatedContext.split('\n').filter(l => l.trim()).map((line, i) => (
                          <div key={i} className="flex gap-4">
                             <span className="text-neutral-600 shrink-0 w-4 text-right">{i+1}</span>
                             <span>{line}</span>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-500 opacity-50">
                       <Database className="h-8 w-8 mb-2" />
                       <p>Nenhum contexto gerado. Clique em "Regenerar Contexto" para ativar.</p>
                    </div>
                 )}
              </div>
           </CardContent>
        </Card>

      </div>

      {/* Links Rápidos (Grid Final) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer group hover:border-primary/50 transition-all hover:shadow-lg border-2 border-transparent">
             <a href="/dashboard/settings/ai/examples" className="block p-4">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <MessageSquare className="h-6 w-6 text-primary" />
                   </div>
                   <div>
                      <p className="font-bold">Exemplos de Chat</p>
                      <p className="text-xs text-muted-foreground">Melhore o tom da conversa.</p>
                   </div>
                   <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
             </a>
          </Card>

          <Card className="cursor-pointer group hover:border-primary/50 transition-all hover:shadow-lg border-2 border-transparent">
             <a href="/dashboard/settings/ai/knowledge" className="block p-4">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                      <Database className="h-6 w-6 text-blue-500" />
                   </div>
                   <div>
                      <p className="font-bold">Documentos & PDF</p>
                      <p className="text-xs text-muted-foreground">Ensaie sua IA com manuais.</p>
                   </div>
                   <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
             </a>
          </Card>

          <Card className="p-4 border-dashed border-2 flex items-center gap-4 opacity-60">
             <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                <Settings className="h-6 w-6 text-neutral-500" />
             </div>
             <div>
                <p className="font-bold">Logs Avançados</p>
                <p className="text-xs text-muted-foreground">Em breve: debugar decisões da IA.</p>
             </div>
             <Badge variant="outline" className="ml-auto text-[10px]">SOON</Badge>
          </Card>
      </div>
    </div>
  );
}
