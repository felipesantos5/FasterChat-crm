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
import { AIKnowledge, Product } from "@/types/ai-knowledge";
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
  CheckCircle2,
  Clock,
  CreditCard,
  Truck,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [knowledge, setKnowledge] = useState<AIKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingContext, setGeneratingContext] = useState(false);

  // Estado do wizard
  const [currentStep, setCurrentStep] = useState(0);
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Campos do formulário
  const [companyName, setCompanyName] = useState("");
  const [companySegment, setCompanySegment] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  const [aiObjective, setAiObjective] = useState("");
  const [aiPersonality, setAiPersonality] = useState("");

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
  });

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
      const companyId = getCompanyId();
      if (!companyId) {
        toast.error("Empresa não encontrada");
        return;
      }

      const response = await aiKnowledgeApi.getKnowledge(companyId);

      if (response.data) {
        setKnowledge(response.data);

        // Preenche os campos
        setCompanyName(response.data.companyName || "");
        setCompanySegment(response.data.companySegment || "");
        setCompanyDescription(response.data.companyDescription || response.data.companyInfo || "");

        setAiObjective(response.data.aiObjective || "");
        setAiPersonality(response.data.aiPersonality || response.data.toneInstructions || "");

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
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  const saveKnowledge = async (nextStep?: number) => {
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
        aiObjective,
        aiPersonality,
        workingHours,
        paymentMethods,
        deliveryInfo,
        warrantyInfo,
        products,
        autoReplyEnabled,
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
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts([...products, newProduct]);
    }

    setProductForm({ name: "", description: "", price: "", category: "" });
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
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se setup completo, mostra visão geral
  if (setupCompleted) {
    return <CompletedView
      knowledge={knowledge}
      companyName={companyName}
      companySegment={companySegment}
      companyDescription={companyDescription}
      aiObjective={aiObjective}
      aiPersonality={aiPersonality}
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
              <div
                className={cn(
                  "flex flex-col items-center",
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
                      : "border-muted-foreground/30"
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
              </div>
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
                <Label htmlFor="companyName">Nome da Empresa *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: ClimaTech Ar Condicionado"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySegment">Segmento de Atuação *</Label>
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
                  rows={5}
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
              <div className="space-y-2">
                <Label htmlFor="aiObjective">Qual o objetivo da sua IA?</Label>
                <Textarea
                  id="aiObjective"
                  value={aiObjective}
                  onChange={(e) => setAiObjective(e.target.value)}
                  placeholder="Ex: Atender clientes via WhatsApp, tirar dúvidas sobre produtos, agendar visitas técnicas, informar preços..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiPersonality">Personalidade e Tom de Voz</Label>
                <Textarea
                  id="aiPersonality"
                  value={aiPersonality}
                  onChange={(e) => setAiPersonality(e.target.value)}
                  placeholder="Ex: Seja amigável e profissional, use linguagem simples, pode usar emojis com moderação, sempre se apresente como 'Assistente Virtual da ClimaTech'..."
                  rows={4}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">💡 Dicas para um bom tom de voz:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Defina se deve ser formal ou informal</li>
                  <li>• Indique se pode usar emojis</li>
                  <li>• Especifique como deve se apresentar</li>
                  <li>• Mencione o que nunca deve fazer (ex: prometer prazos impossíveis)</li>
                </ul>
              </div>
            </>
          )}

          {/* Step 2: Políticas */}
          {currentStep === 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workingHours" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horário de Atendimento
                  </Label>
                  <Input
                    id="workingHours"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="Ex: Segunda a Sexta, 8h às 18h"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethods" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Formas de Pagamento
                  </Label>
                  <Input
                    id="paymentMethods"
                    value={paymentMethods}
                    onChange={(e) => setPaymentMethods(e.target.value)}
                    placeholder="Ex: PIX, Cartão, Dinheiro"
                  />
                </div>
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
                  placeholder="Ex: Entrega em até 3 dias úteis para a região metropolitana. Frete grátis acima de R$ 200..."
                  rows={3}
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
                  placeholder="Ex: Garantia de 1 ano para todos os serviços. Troca em até 7 dias em caso de defeito..."
                  rows={3}
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
                          setProductForm({ name: "", description: "", price: "", category: "" });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="Ex: Instalação de Ar Split"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preço</Label>
                        <Input
                          value={productForm.price}
                          onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                          placeholder="Ex: R$ 350,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Input
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        placeholder="Ex: Instalação, Manutenção, Produto..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Descreva o produto ou serviço..."
                        rows={3}
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
                    <Card key={product.id} className="relative group">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{product.name}</h4>
                            {product.category && (
                              <Badge variant="secondary" className="mt-1">
                                {product.category}
                              </Badge>
                            )}
                            {product.price && (
                              <p className="text-sm text-primary font-medium mt-2">
                                {product.price}
                              </p>
                            )}
                            {product.description && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {product.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
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
  aiObjective,
  aiPersonality,
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
  aiObjective: string;
  aiPersonality: string;
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
  saveKnowledge: () => void;
}) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Configuração da IA
          </h1>
          <p className="text-muted-foreground">
            Sua assistente virtual está configurada e pronta para atender
          </p>
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
      </div>

      {/* Toggle de Resposta Automática */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
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
                saveKnowledge();
              }}
            />
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
              <Target className="h-5 w-5" />
              Objetivo da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiObjective && (
              <div>
                <span className="text-sm text-muted-foreground">Objetivo:</span>
                <p className="text-sm line-clamp-3">{aiObjective}</p>
              </div>
            )}
            {aiPersonality && (
              <div>
                <span className="text-sm text-muted-foreground">Personalidade:</span>
                <p className="text-sm line-clamp-3">{aiPersonality}</p>
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
