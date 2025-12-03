"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AppointmentType,
  AppointmentTypeLabels,
  CreateAppointmentData,
  TimeSlot,
} from "@/types/appointment";
import { appointmentApi } from "@/lib/appointment";
import { cn } from "@/lib/utils";

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  customers: Array<{ id: string; name: string; email?: string }>;
}

export function AppointmentModal({
  open,
  onClose,
  onSuccess,
  companyId,
  customers,
}: AppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [formData, setFormData] = useState<CreateAppointmentData>({
    customerId: "",
    title: "",
    description: "",
    type: AppointmentType.CONSULTATION,
    startTime: "",
    endTime: "",
    duration: 60, // Duração padrão de 60 minutos
    location: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate, formData.duration]);

  const loadAvailableSlots = async () => {
    if (!selectedDate) return;

    try {
      setLoadingSlots(true);
      setSelectedSlot(null); // Limpa o slot selecionado ao mudar a duração
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const slots = await appointmentApi.getAvailableSlots(companyId, dateStr, formData.duration);
      setAvailableSlots(slots);
    } catch (error) {
      console.error("Error loading available slots:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setFormData({
      ...formData,
      startTime: new Date(slot.start).toISOString(),
      endTime: new Date(slot.end).toISOString(),
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerId) newErrors.customerId = "Cliente é obrigatório";
    if (!formData.title) newErrors.title = "Título é obrigatório";
    if (!formData.startTime) newErrors.startTime = "Data e horário são obrigatórios";
    if (!formData.type) newErrors.type = "Tipo é obrigatório";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      await appointmentApi.create(companyId, formData);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error creating appointment:", error);
      alert("Erro ao criar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customerId: "",
      title: "",
      description: "",
      type: AppointmentType.CONSULTATION,
      startTime: "",
      endTime: "",
      duration: 60,
      location: "",
      notes: "",
    });
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription>
            Crie um novo agendamento e sincronize automaticamente com Google Calendar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="customer">Cliente *</Label>
            <Select
              value={formData.customerId}
              onValueChange={(value) => setFormData({ ...formData, customerId: value })}
            >
              <SelectTrigger className={errors.customerId ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} {customer.email && `(${customer.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.customerId && (
              <p className="text-sm text-red-500">{errors.customerId}</p>
            )}
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Consulta de vendas"
              className={errors.title ? "border-red-500" : ""}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as AppointmentType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AppointmentType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {AppointmentTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duração do Serviço *</Label>
            <Select
              value={formData.duration.toString()}
              onValueChange={(value) => setFormData({ ...formData, duration: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1 hora e 30 minutos</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
                <SelectItem value="180">3 horas</SelectItem>
                <SelectItem value="240">4 horas</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os horários disponíveis serão ajustados com base nesta duração
            </p>
          </div>

          {/* Data e Horário - Layout Melhorado */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Data e Horário *</Label>
              <p className="text-sm text-muted-foreground">Selecione a data e depois escolha o horário disponível</p>
            </div>

            {/* Seletor de Data */}
            <div className="space-y-2">
              <Label>1. Escolha a Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-12",
                      !selectedDate && "text-muted-foreground",
                      errors.startTime && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Clique para selecionar uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center" side="bottom">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={ptBR}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Horários Disponíveis */}
            {selectedDate && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-base">2. Escolha o Horário</Label>
                  {selectedSlot && (
                    <Badge variant="default" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedSlot.start), "HH:mm")} - {format(new Date(selectedSlot.end), "HH:mm")}
                    </Badge>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Buscando horários disponíveis...</p>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center p-8 border-2 border-dashed rounded-md">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum horário disponível</p>
                    <p className="text-xs text-muted-foreground mt-1">Tente selecionar outra data</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {availableSlots.length} horário(s) disponível(is) para {format(selectedDate, "dd/MM/yyyy")} ({formData.duration} minutos cada)
                    </p>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                      {availableSlots.map((slot, index) => {
                        const isSelected = selectedSlot?.start === slot.start;
                        return (
                          <Button
                            key={index}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSlotSelect(slot)}
                            className={cn(
                              "h-12 font-medium transition-all flex flex-col items-center justify-center",
                              isSelected && "ring-2 ring-primary ring-offset-2"
                            )}
                          >
                            <span className="text-sm">{format(new Date(slot.start), "HH:mm")}</span>
                            <span className="text-[10px] opacity-70">-{format(new Date(slot.end), "HH:mm")}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedDate && (
              <div className="text-center p-6 border-2 border-dashed rounded-md bg-muted/20">
                <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Selecione uma data acima para ver os horários disponíveis</p>
              </div>
            )}

            {errors.startTime && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="font-medium">⚠️</span> {errors.startTime}
              </p>
            )}
          </div>

          {/* Localização */}
          <div className="space-y-2">
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Escritório principal, Endereço do cliente"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva os detalhes do agendamento"
              rows={3}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Internas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas privadas sobre este agendamento"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Agendamento"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
