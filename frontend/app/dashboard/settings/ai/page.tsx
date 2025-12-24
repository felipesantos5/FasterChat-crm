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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProtectedPage } from "@/components/layout/protected-page";
import { LoadingErrorState } from "@/components/ui/error-state";
import { useErrorHandler } from "@/hooks/use-error-handler";

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
  { id: 2, title: "Políticas", icon: FileText, description: "Regras do negócio" },
  { id: 3, title: "Produtos", icon: Package, description: "O que você oferece" },
  { id: 4, title: "Finalizar", icon: Sparkles, description: "Gerar contexto" },
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
  const [paymentMethods, setPaymentMethods] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [warrantyInfo, setWarrantyInfo] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [generatedContext, setGeneratedContext] = useState("");

  // Produto em edição
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    duration: "", // Duração em minutos
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
        setPaymentMethods(response.data.paymentMethods || "");
        setDeliveryInfo(response.data.deliveryInfo || "");
        setWarrantyInfo(response.data.warrantyInfo || "");

        setProducts(response.data.products || []);
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
        workingHours,
        paymentMethods,
        deliveryInfo,
        warrantyInfo,
        products,
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
    await saveKnowledge(nextStep);
    setCurrentStep(nextStep);
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

      // Primeiro salva todas as informações
      await saveKnowledge();

      // Depois gera o contexto
      const response = await aiKnowledgeApi.generateContext(companyId);

      if (response.data) {
        setGeneratedContext(response.data.generatedContext);
        setSetupCompleted(true);

        // Salva com setupCompleted = true
        await aiKnowledgeApi.updateKnowledge({
          companyId,
          setupCompleted: true,
          setupStep: 4,
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
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts([...products, newProduct]);
    }

    setProductForm({ name: "", description: "", price: "", category: "", duration: "" });
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
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId));
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
      paymentMethods={paymentMethods}
      deliveryInfo={deliveryInfo}
      warrantyInfo={warrantyInfo}
      products={products}
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

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Comportamento Profissional Automático
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Sua IA já vem configurada com as melhores práticas de atendimento:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Comunicação educada e profissional</li>
                  <li>• Respostas claras e objetivas</li>
                  <li>• Uso moderado de emojis</li>
                  <li>• Tratamento respeitoso ao cliente</li>
                  <li>• <strong>Nunca inventa preços</strong> - usa apenas valores cadastrados</li>
                  <li>• Encaminha para humano quando necessário</li>
                </ul>
              </div>
            </>
          )}

          {/* Step 2: Políticas */}
          {currentStep === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="workingHours" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horário de Atendimento
                </Label>
                <Textarea
                  id="workingHours"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="Ex: Segunda a Sexta: 8h às 18h | Sábado: 8h às 13h | Domingo: Fechado"
                  rows={3}
                  className="min-h-[80px]"
                />
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

          {/* Step 3: Produtos/Serviços */}
          {currentStep === 3 && (
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
                          setProductForm({ name: "", description: "", price: "", category: "", duration: "" });
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                    <Button onClick={handleAddProduct} className="w-full">
                      {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Lista de Produtos */}
              {products.length > 0 ? (
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

                            {/* Preço e Duração */}
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

          {/* Step 4: Finalizar */}
          {currentStep === 4 && (
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
          {currentStep < 4 && (
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>

              <Button onClick={handleNextStep} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
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
  paymentMethods,
  deliveryInfo,
  warrantyInfo,
  products,
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
  paymentMethods: string;
  deliveryInfo: string;
  warrantyInfo: string;
  products: Product[];
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
            {workingHours && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{workingHours}</span>
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

        {/* Produtos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Produtos/Serviços
              <Badge variant="secondary" className="ml-auto">
                {products.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {products.length > 0 ? (
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
