"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Trash2,
  Edit3,
  X,
  MapPin,
  Package,
  Layers,
  AlertTriangle,
  DollarSign,
  Info,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProtectedPage } from "@/components/layout/protected-page";
import api from "@/lib/api";

// ==================== INTERFACES ====================

interface ServiceZone {
  id?: string;
  name: string;
  description?: string;
  pricingType: "FIXED" | "PERCENTAGE" | "CUSTOM";
  priceModifier: number;
  neighborhoods: string[];
  isDefault: boolean;
  requiresQuote: boolean;
  isActive: boolean;
}

interface ServiceComboItem {
  serviceId: string;
  serviceName?: string;
  quantity: number;
  notes?: string;
}

interface ServiceCombo {
  id?: string;
  name: string;
  description?: string;
  fixedPrice: number;
  category?: string;
  isActive: boolean;
  items: ServiceComboItem[];
}

interface ServiceAdditional {
  id?: string;
  name: string;
  description?: string;
  price: number;
  appliesToCategories: string[];
  isActive: boolean;
}

interface ZoneException {
  id?: string;
  zoneId: string;
  zoneName?: string;
  serviceId?: string;
  category?: string;
  minQuantity?: number;
  exceptionType: "NO_FEE" | "CUSTOM_FEE";
  customFee?: number;
  description?: string;
  isActive: boolean;
}

interface Service {
  id: string;
  name: string;
  category?: string;
}

// ==================== PAGE COMPONENT ====================

export default function PricingSettingsPage() {
  return (
    <ProtectedPage requiredPage="AI_CONFIG">
      <PricingSettingsContent />
    </ProtectedPage>
  );
}

function PricingSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("zones");

  // Data states
  const [zones, setZones] = useState<ServiceZone[]>([]);
  const [combos, setCombos] = useState<ServiceCombo[]>([]);
  const [additionals, setAdditionals] = useState<ServiceAdditional[]>([]);
  const [exceptions, setExceptions] = useState<ZoneException[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Form states
  const [editingZone, setEditingZone] = useState<ServiceZone | null>(null);
  const [editingCombo, setEditingCombo] = useState<ServiceCombo | null>(null);
  const [editingAdditional, setEditingAdditional] = useState<ServiceAdditional | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showComboForm, setShowComboForm] = useState(false);
  const [showAdditionalForm, setShowAdditionalForm] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  // ==================== LOAD DATA ====================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [zonesRes, combosRes, additionalsRes, exceptionsRes, servicesRes] = await Promise.all([
        api.get("/services/zones/list").catch(() => ({ data: [] })),
        api.get("/services/combos/list").catch(() => ({ data: [] })),
        api.get("/services/additionals/list").catch(() => ({ data: [] })),
        api.get("/services/zone-exceptions/list").catch(() => ({ data: [] })),
        api.get("/services").catch(() => ({ data: [] })),
      ]);

      setZones(zonesRes.data || []);
      setCombos(combosRes.data || []);
      setAdditionals(additionalsRes.data || []);
      setExceptions(exceptionsRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados de precificação");
    } finally {
      setLoading(false);
    }
  };

  // ==================== ZONES ====================

  const [zoneForm, setZoneForm] = useState<ServiceZone>({
    name: "",
    description: "",
    pricingType: "FIXED",
    priceModifier: 0,
    neighborhoods: [],
    isDefault: false,
    requiresQuote: false,
    isActive: true,
  });
  const [neighborhoodInput, setNeighborhoodInput] = useState("");

  const resetZoneForm = () => {
    setZoneForm({
      name: "",
      description: "",
      pricingType: "FIXED",
      priceModifier: 0,
      neighborhoods: [],
      isDefault: false,
      requiresQuote: false,
      isActive: true,
    });
    setNeighborhoodInput("");
    setEditingZone(null);
    setShowZoneForm(false);
  };

  const handleEditZone = (zone: ServiceZone) => {
    setZoneForm({
      ...zone,
      priceModifier: Number(zone.priceModifier),
    });
    setEditingZone(zone);
    setShowZoneForm(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) {
      toast.error("Nome da zona é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (editingZone?.id) {
        await api.put(`/services/zones/${editingZone.id}`, zoneForm);
        toast.success("Zona atualizada!");
      } else {
        await api.post("/services/zones", zoneForm);
        toast.success("Zona criada!");
      }
      await loadAllData();
      resetZoneForm();
    } catch (error) {
      console.error("Erro ao salvar zona:", error);
      toast.error("Erro ao salvar zona");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta zona?")) return;
    try {
      await api.delete(`/services/zones/${id}`);
      toast.success("Zona excluída!");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao excluir zona");
    }
  };

  const addNeighborhood = () => {
    if (neighborhoodInput.trim() && !zoneForm.neighborhoods.includes(neighborhoodInput.trim())) {
      setZoneForm({
        ...zoneForm,
        neighborhoods: [...zoneForm.neighborhoods, neighborhoodInput.trim()],
      });
      setNeighborhoodInput("");
    }
  };

  const removeNeighborhood = (neighborhood: string) => {
    setZoneForm({
      ...zoneForm,
      neighborhoods: zoneForm.neighborhoods.filter((n) => n !== neighborhood),
    });
  };

  // ==================== COMBOS ====================

  const [comboForm, setComboForm] = useState<ServiceCombo>({
    name: "",
    description: "",
    fixedPrice: 0,
    category: "",
    isActive: true,
    items: [],
  });

  const resetComboForm = () => {
    setComboForm({
      name: "",
      description: "",
      fixedPrice: 0,
      category: "",
      isActive: true,
      items: [],
    });
    setEditingCombo(null);
    setShowComboForm(false);
  };

  const handleEditCombo = (combo: ServiceCombo) => {
    setComboForm({
      ...combo,
      fixedPrice: Number(combo.fixedPrice),
      items: combo.items || [],
    });
    setEditingCombo(combo);
    setShowComboForm(true);
  };

  const handleSaveCombo = async () => {
    if (!comboForm.name.trim()) {
      toast.error("Nome do combo é obrigatório");
      return;
    }
    if (comboForm.fixedPrice <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }

    setSaving(true);
    try {
      if (editingCombo?.id) {
        await api.put(`/services/combos/${editingCombo.id}`, comboForm);
        if (comboForm.items.length > 0) {
          await api.put(`/services/combos/${editingCombo.id}/items`, { items: comboForm.items });
        }
        toast.success("Combo atualizado!");
      } else {
        await api.post("/services/combos", comboForm);
        toast.success("Combo criado!");
      }
      await loadAllData();
      resetComboForm();
    } catch (error) {
      console.error("Erro ao salvar combo:", error);
      toast.error("Erro ao salvar combo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCombo = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este combo?")) return;
    try {
      await api.delete(`/services/combos/${id}`);
      toast.success("Combo excluído!");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao excluir combo");
    }
  };

  const addComboItem = () => {
    setComboForm({
      ...comboForm,
      items: [...comboForm.items, { serviceId: "", quantity: 1, notes: "" }],
    });
  };

  const updateComboItem = (index: number, field: keyof ServiceComboItem, value: any) => {
    const newItems = [...comboForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setComboForm({ ...comboForm, items: newItems });
  };

  const removeComboItem = (index: number) => {
    setComboForm({
      ...comboForm,
      items: comboForm.items.filter((_, i) => i !== index),
    });
  };

  // ==================== ADDITIONALS ====================

  const [additionalForm, setAdditionalForm] = useState<ServiceAdditional>({
    name: "",
    description: "",
    price: 0,
    appliesToCategories: [],
    isActive: true,
  });

  const resetAdditionalForm = () => {
    setAdditionalForm({
      name: "",
      description: "",
      price: 0,
      appliesToCategories: [],
      isActive: true,
    });
    setEditingAdditional(null);
    setShowAdditionalForm(false);
  };

  const handleEditAdditional = (additional: ServiceAdditional) => {
    setAdditionalForm({
      ...additional,
      price: Number(additional.price),
    });
    setEditingAdditional(additional);
    setShowAdditionalForm(true);
  };

  const handleSaveAdditional = async () => {
    if (!additionalForm.name.trim()) {
      toast.error("Nome do adicional é obrigatório");
      return;
    }
    if (additionalForm.price <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }

    setSaving(true);
    try {
      if (editingAdditional?.id) {
        await api.put(`/services/additionals/${editingAdditional.id}`, additionalForm);
        toast.success("Adicional atualizado!");
      } else {
        await api.post("/services/additionals", additionalForm);
        toast.success("Adicional criado!");
      }
      await loadAllData();
      resetAdditionalForm();
    } catch (error) {
      console.error("Erro ao salvar adicional:", error);
      toast.error("Erro ao salvar adicional");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdditional = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este adicional?")) return;
    try {
      await api.delete(`/services/additionals/${id}`);
      toast.success("Adicional excluído!");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao excluir adicional");
    }
  };

  // ==================== EXCEPTIONS ====================

  const [exceptionForm, setExceptionForm] = useState<ZoneException>({
    zoneId: "",
    category: "",
    minQuantity: undefined,
    exceptionType: "NO_FEE",
    customFee: undefined,
    description: "",
    isActive: true,
  });

  const resetExceptionForm = () => {
    setExceptionForm({
      zoneId: "",
      category: "",
      minQuantity: undefined,
      exceptionType: "NO_FEE",
      customFee: undefined,
      description: "",
      isActive: true,
    });
    setShowExceptionForm(false);
  };

  const handleSaveException = async () => {
    if (!exceptionForm.zoneId) {
      toast.error("Selecione uma zona");
      return;
    }
    if (!exceptionForm.category && !exceptionForm.minQuantity) {
      toast.error("Defina uma categoria ou quantidade mínima");
      return;
    }

    setSaving(true);
    try {
      await api.post("/services/zone-exceptions", exceptionForm);
      toast.success("Exceção criada!");
      await loadAllData();
      resetExceptionForm();
    } catch (error) {
      console.error("Erro ao salvar exceção:", error);
      toast.error("Erro ao salvar exceção");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteException = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta exceção?")) return;
    try {
      await api.delete(`/services/zone-exceptions/${id}`);
      toast.success("Exceção excluída!");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao excluir exceção");
    }
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Precificação Avançada</h1>
        <p className="text-muted-foreground">
          Configure zonas de atendimento, pacotes, adicionais e regras especiais de preço
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Como funciona a precificação avançada?</p>
            <ul className="space-y-1 text-blue-700 dark:text-blue-300">
              <li><strong>Zonas:</strong> Defina regiões com taxas diferentes (ex: Ilha +R$55)</li>
              <li><strong>Combos:</strong> Crie pacotes com preço fixo (ex: 2 Splits = R$1.495)</li>
              <li><strong>Adicionais:</strong> Serviços extras opcionais (ex: Rapel +R$650)</li>
              <li><strong>Exceções:</strong> Regras que anulam taxas (ex: Limpeza +2 equipamentos sem taxa)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="zones" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Zonas</span>
            <Badge variant="secondary" className="ml-1">{zones.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="combos" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Combos</span>
            <Badge variant="secondary" className="ml-1">{combos.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="additionals" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionais</span>
            <Badge variant="secondary" className="ml-1">{additionals.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Exceções</span>
            <Badge variant="secondary" className="ml-1">{exceptions.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ==================== ZONAS TAB ==================== */}
        <TabsContent value="zones" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Zonas de Atendimento</h2>
              <p className="text-sm text-muted-foreground">
                Defina regiões com preços diferenciados baseados em bairros
              </p>
            </div>
            <Button onClick={() => setShowZoneForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Nova Zona
            </Button>
          </div>

          {/* Zone Form */}
          {showZoneForm && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  {editingZone ? "Editar Zona" : "Nova Zona"}
                  <Button variant="ghost" size="icon" onClick={resetZoneForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Zona *</Label>
                    <Input
                      value={zoneForm.name}
                      onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                      placeholder="Ex: Continente, Ilha, Extremos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Taxa</Label>
                    <select
                      value={zoneForm.pricingType}
                      onChange={(e) => setZoneForm({ ...zoneForm, pricingType: e.target.value as any })}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="FIXED">Valor Fixo (R$)</option>
                      <option value="PERCENTAGE">Percentual (%)</option>
                      <option value="CUSTOM">Orçamento Especial</option>
                    </select>
                  </div>
                </div>

                {zoneForm.pricingType !== "CUSTOM" && (
                  <div className="space-y-2">
                    <Label>
                      {zoneForm.pricingType === "FIXED" ? "Taxa Adicional (R$)" : "Taxa Adicional (%)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={zoneForm.priceModifier}
                      onChange={(e) => setZoneForm({ ...zoneForm, priceModifier: parseFloat(e.target.value) || 0 })}
                      placeholder={zoneForm.pricingType === "FIXED" ? "55.00" : "10"}
                    />
                    <p className="text-xs text-muted-foreground">
                      {zoneForm.pricingType === "FIXED"
                        ? "Valor que será adicionado ao preço base do serviço"
                        : "Percentual que será adicionado ao preço base"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={zoneForm.description || ""}
                    onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                    placeholder="Descreva os detalhes desta zona..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bairros Incluídos</Label>
                  <div className="flex gap-2">
                    <Input
                      value={neighborhoodInput}
                      onChange={(e) => setNeighborhoodInput(e.target.value)}
                      placeholder="Digite o nome do bairro"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNeighborhood())}
                    />
                    <Button type="button" variant="outline" onClick={addNeighborhood}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {zoneForm.neighborhoods.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {zoneForm.neighborhoods.map((neighborhood) => (
                        <Badge key={neighborhood} variant="secondary" className="flex items-center gap-1">
                          {neighborhood}
                          <button
                            type="button"
                            onClick={() => removeNeighborhood(neighborhood)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={zoneForm.isDefault}
                      onCheckedChange={(checked) => setZoneForm({ ...zoneForm, isDefault: checked })}
                    />
                    <Label className="font-normal">Zona padrão (preço base)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={zoneForm.requiresQuote}
                      onCheckedChange={(checked) => setZoneForm({ ...zoneForm, requiresQuote: checked })}
                    />
                    <Label className="font-normal">Requer orçamento especial</Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={resetZoneForm}>Cancelar</Button>
                  <Button onClick={handleSaveZone} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zones List */}
          {zones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <Card key={zone.id} className={cn("relative", zone.isDefault && "border-primary")}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold">{zone.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditZone(zone)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteZone(zone.id!)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {zone.isDefault ? (
                      <Badge variant="default" className="mb-2">Zona Padrão (Base)</Badge>
                    ) : zone.requiresQuote ? (
                      <Badge variant="outline" className="mb-2">Orçamento Especial</Badge>
                    ) : (
                      <Badge variant="secondary" className="mb-2">
                        +{zone.pricingType === "FIXED" ? `R$ ${Number(zone.priceModifier).toFixed(2)}` : `${zone.priceModifier}%`}
                      </Badge>
                    )}

                    {zone.description && (
                      <p className="text-sm text-muted-foreground mb-2">{zone.description}</p>
                    )}

                    {zone.neighborhoods.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {zone.neighborhoods.slice(0, 5).map((n) => (
                          <Badge key={n} variant="outline" className="text-xs">{n}</Badge>
                        ))}
                        {zone.neighborhoods.length > 5 && (
                          <Badge variant="outline" className="text-xs">+{zone.neighborhoods.length - 5}</Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-1">Nenhuma zona cadastrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie zonas para definir preços diferentes por região
                </p>
                <Button onClick={() => setShowZoneForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Primeira Zona
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== COMBOS TAB ==================== */}
        <TabsContent value="combos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pacotes e Combos</h2>
              <p className="text-sm text-muted-foreground">
                Crie combinações de serviços com preço fixo especial
              </p>
            </div>
            <Button onClick={() => setShowComboForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Combo
            </Button>
          </div>

          {/* Combo Form */}
          {showComboForm && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  {editingCombo ? "Editar Combo" : "Novo Combo"}
                  <Button variant="ghost" size="icon" onClick={resetComboForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Combo *</Label>
                    <Input
                      value={comboForm.name}
                      onChange={(e) => setComboForm({ ...comboForm, name: e.target.value })}
                      placeholder="Ex: Instalação 2 Splits 9K"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço Fixo (R$) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={comboForm.fixedPrice}
                        onChange={(e) => setComboForm({ ...comboForm, fixedPrice: parseFloat(e.target.value) || 0 })}
                        className="pl-9"
                        placeholder="1495.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria (opcional)</Label>
                    <Input
                      value={comboForm.category || ""}
                      onChange={(e) => setComboForm({ ...comboForm, category: e.target.value })}
                      placeholder="Ex: Instalação, Limpeza"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={comboForm.description || ""}
                    onChange={(e) => setComboForm({ ...comboForm, description: e.target.value })}
                    placeholder="Descreva o que está incluído neste combo..."
                    rows={2}
                  />
                </div>

                {/* Combo Items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Itens do Combo (opcional)</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addComboItem}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Item
                    </Button>
                  </div>

                  {comboForm.items.length > 0 ? (
                    <div className="space-y-2">
                      {comboForm.items.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center bg-muted/50 p-2 rounded-lg">
                          <select
                            value={item.serviceId}
                            onChange={(e) => updateComboItem(index, "serviceId", e.target.value)}
                            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Selecione um serviço</option>
                            {services.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateComboItem(index, "quantity", parseInt(e.target.value) || 1)}
                            className="w-20"
                            placeholder="Qtd"
                          />
                          <Input
                            value={item.notes || ""}
                            onChange={(e) => updateComboItem(index, "notes", e.target.value)}
                            className="w-32"
                            placeholder="Obs"
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeComboItem(index)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">
                      Nenhum item adicionado. Você pode adicionar referências aos serviços que compõem este combo.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={resetComboForm}>Cancelar</Button>
                  <Button onClick={handleSaveCombo} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Combos List */}
          {combos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combos.map((combo) => (
                <Card key={combo.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold">{combo.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCombo(combo)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteCombo(combo.id!)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default" className="text-lg font-bold">
                        R$ {Number(combo.fixedPrice).toFixed(2)}
                      </Badge>
                      {combo.category && (
                        <Badge variant="outline">{combo.category}</Badge>
                      )}
                    </div>

                    {combo.description && (
                      <p className="text-sm text-muted-foreground mb-2">{combo.description}</p>
                    )}

                    {combo.items && combo.items.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Inclui:</span>
                        <ul className="mt-1 space-y-0.5">
                          {combo.items.map((item: any, idx: number) => (
                            <li key={idx}>• {item.quantity}x {item.service?.name || item.serviceName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-1">Nenhum combo cadastrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie pacotes com preço fixo para combinações de serviços
                </p>
                <Button onClick={() => setShowComboForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Primeiro Combo
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== ADDITIONALS TAB ==================== */}
        <TabsContent value="additionals" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Serviços Adicionais</h2>
              <p className="text-sm text-muted-foreground">
                Defina extras opcionais que podem ser adicionados aos serviços
              </p>
            </div>
            <Button onClick={() => setShowAdditionalForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Adicional
            </Button>
          </div>

          {/* Additional Form */}
          {showAdditionalForm && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  {editingAdditional ? "Editar Adicional" : "Novo Adicional"}
                  <Button variant="ghost" size="icon" onClick={resetAdditionalForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Adicional *</Label>
                    <Input
                      value={additionalForm.name}
                      onChange={(e) => setAdditionalForm({ ...additionalForm, name: e.target.value })}
                      placeholder="Ex: Rapel, Infra Complexa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (R$) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={additionalForm.price}
                        onChange={(e) => setAdditionalForm({ ...additionalForm, price: parseFloat(e.target.value) || 0 })}
                        className="pl-9"
                        placeholder="650.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    value={additionalForm.description || ""}
                    onChange={(e) => setAdditionalForm({ ...additionalForm, description: e.target.value })}
                    placeholder="Descreva quando este adicional deve ser aplicado..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={resetAdditionalForm}>Cancelar</Button>
                  <Button onClick={handleSaveAdditional} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additionals List */}
          {additionals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {additionals.map((additional) => (
                <Card key={additional.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold">{additional.name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditAdditional(additional)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAdditional(additional.id!)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <Badge variant="secondary" className="text-lg font-bold mb-2">
                      +R$ {Number(additional.price).toFixed(2)}
                    </Badge>

                    {additional.description && (
                      <p className="text-sm text-muted-foreground">{additional.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-1">Nenhum adicional cadastrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie extras opcionais como rapel, infra complexa, etc.
                </p>
                <Button onClick={() => setShowAdditionalForm(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Primeiro Adicional
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== EXCEPTIONS TAB ==================== */}
        <TabsContent value="exceptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Exceções de Taxa</h2>
              <p className="text-sm text-muted-foreground">
                Defina regras que anulam ou modificam taxas de zona em casos específicos
              </p>
            </div>
            <Button onClick={() => setShowExceptionForm(true)} disabled={zones.length === 0}>
              <Plus className="w-4 h-4 mr-1" />
              Nova Exceção
            </Button>
          </div>

          {zones.length === 0 && (
            <Card className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
              <CardContent className="py-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Você precisa criar pelo menos uma zona antes de definir exceções.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Exception Form */}
          {showExceptionForm && zones.length > 0 && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Nova Exceção de Taxa
                  <Button variant="ghost" size="icon" onClick={resetExceptionForm}>
                    <X className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Zona Afetada *</Label>
                    <select
                      value={exceptionForm.zoneId}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, zoneId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Selecione uma zona</option>
                      {zones.filter(z => !z.isDefault).map((z) => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Exceção</Label>
                    <select
                      value={exceptionForm.exceptionType}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, exceptionType: e.target.value as any })}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="NO_FEE">Sem taxa (isento)</option>
                      <option value="CUSTOM_FEE">Taxa customizada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria (opcional)</Label>
                    <Input
                      value={exceptionForm.category || ""}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, category: e.target.value })}
                      placeholder="Ex: Limpeza, Instalação"
                    />
                    <p className="text-xs text-muted-foreground">
                      A exceção será aplicada a serviços desta categoria
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade Mínima (opcional)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={exceptionForm.minQuantity || ""}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, minQuantity: parseInt(e.target.value) || undefined })}
                      placeholder="Ex: 2"
                    />
                    <p className="text-xs text-muted-foreground">
                      A exceção só vale a partir desta quantidade
                    </p>
                  </div>
                </div>

                {exceptionForm.exceptionType === "CUSTOM_FEE" && (
                  <div className="space-y-2">
                    <Label>Taxa Customizada (R$)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        value={exceptionForm.customFee || ""}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, customFee: parseFloat(e.target.value) || undefined })}
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Descrição da Regra</Label>
                  <Textarea
                    value={exceptionForm.description || ""}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, description: e.target.value })}
                    placeholder="Ex: Limpeza de mais de 2 equipamentos não tem taxa da Ilha"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={resetExceptionForm}>Cancelar</Button>
                  <Button onClick={handleSaveException} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exceptions List */}
          {exceptions.length > 0 ? (
            <div className="space-y-3">
              {exceptions.map((exception) => {
                const zone = zones.find(z => z.id === exception.zoneId);
                return (
                  <Card key={exception.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {exception.category ? `Categoria: ${exception.category}` : "Todos os serviços"}
                              </span>
                              {exception.minQuantity && (
                                <Badge variant="outline">+{exception.minQuantity} unidades</Badge>
                              )}
                              <span className="text-muted-foreground">na zona</span>
                              <Badge variant="secondary">{zone?.name || "Desconhecida"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {exception.exceptionType === "NO_FEE"
                                ? "Isento de taxa"
                                : `Taxa especial: R$ ${Number(exception.customFee || 0).toFixed(2)}`}
                            </p>
                            {exception.description && (
                              <p className="text-sm text-muted-foreground">{exception.description}</p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteException(exception.id!)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold mb-1">Nenhuma exceção cadastrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie exceções para anular taxas em casos específicos
                </p>
                <Button onClick={() => setShowExceptionForm(true)} disabled={zones.length === 0}>
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Primeira Exceção
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
