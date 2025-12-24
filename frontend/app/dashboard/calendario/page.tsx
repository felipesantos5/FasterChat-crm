"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Plus, Settings, Clock, MapPin, User, Edit, Trash2, CheckCircle } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { appointmentApi } from "@/lib/appointment";
import { googleCalendarApi, GoogleCalendarStatus } from "@/lib/google-calendar";
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  AppointmentStatusLabels,
  AppointmentTypeLabels,
} from "@/types/appointment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { EditAppointmentModal } from "@/components/appointments/EditAppointmentModal";
import { GoogleCalendarModal } from "@/components/appointments/GoogleCalendarModal";
import { buttons, cards, typography, spacing, badges, icons } from "@/lib/design-system";
// ✅ NOVOS IMPORTS
import { useAuthStore } from "@/lib/store/auth.store";
import { useCustomers } from "@/hooks/use-customers";
import { CalendarSkeleton } from "@/components/ui/skeletons";
import { ProtectedPage } from "@/components/layout/protected-page";

const locales = { "pt-BR": ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const messages = {
  allDay: "Dia inteiro",
  previous: "Anterior",
  next: "Próximo",
  today: "Hoje",
  month: "Mês",
  week: "Semana",
  day: "Dia",
  agenda: "Agenda",
  date: "Data",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "Não há agendamentos neste período.",
  showMore: (total: number) => `+ Ver mais (${total})`,
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

export default function CalendarioPage() {
  return (
    <ProtectedPage requiredPage="CALENDAR">
      <CalendarioPageContent />
    </ProtectedPage>
  );
}

function CalendarioPageContent() {
  // ✅ 1. Recuperar dados do usuário autenticado
  const { user } = useAuthStore();
  const companyId = user?.companyId;

  // ✅ 2. Recuperar clientes reais da API
  const { customers } = useCustomers(companyId || null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showEditAppointment, setShowEditAppointment] = useState(false);
  const [showGoogleCalendar, setShowGoogleCalendar] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // ✅ Removido código hardcoded:
  // const companyId = "af874797-cd69-4aed-bc6a-fa9737418905";
  // const customers = [...];

  // ✅ 3. Envelopar funções em useCallback para usar nas dependências do useEffect
  const loadAppointments = useCallback(async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      const dbAppointments = await appointmentApi.getAll(companyId);

      try {
        // Verifica conexão com Google Calendar
        const status = await googleCalendarApi.getStatus(companyId);

        if (status.connected) {
          // Define janela de busca (Mês atual + 2 meses)
          const startDate = new Date();
          startDate.setDate(1);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 2);

          const googleEvents = await googleCalendarApi.getEvents(
            companyId,
            startDate.toISOString(),
            endDate.toISOString()
          );

          // Mapeia eventos do Google para o formato do sistema
          const googleAppointments: Appointment[] = googleEvents.map((event) => ({
            id: event.id,
            companyId,
            customerId: "",
            title: event.summary || "Sem título",
            description: event.description || "",
            type: AppointmentType.CONSULTATION,
            status: event.status === "cancelled" ? AppointmentStatus.CANCELLED : AppointmentStatus.SCHEDULED,
            startTime: event.start.dateTime || event.start.date || new Date().toISOString(),
            endTime: event.end.dateTime || event.end.date || new Date().toISOString(),
            duration: 60,
            location: event.location || "",
            notes: `Evento do Google Calendar${event.htmlLink ? `\n${event.htmlLink}` : ""}`,
            googleEventId: event.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          // Filtra duplicados (eventos que já existem no banco local e estão sincronizados)
          const dbEventIds = new Set(dbAppointments.map(a => a.googleEventId).filter(Boolean));
          const uniqueGoogleEvents = googleAppointments.filter(
            g => !dbEventIds.has(g.googleEventId)
          );

          setAppointments([...dbAppointments, ...uniqueGoogleEvents]);
        } else {
          setAppointments(dbAppointments);
        }
      } catch (googleError) {
        console.warn("Erro ao buscar eventos do Google Calendar:", googleError);
        setAppointments(dbAppointments);
      }
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const checkGoogleConnection = useCallback(async () => {
    if (!companyId) return;
    try {
      const status = await googleCalendarApi.getStatus(companyId);
      setGoogleStatus(status);
    } catch (error) {
      setGoogleStatus(null);
    }
  }, [companyId]);

  // ✅ 4. Atualizar useEffect para depender do companyId
  useEffect(() => {
    if (companyId) {
      loadAppointments();
      checkGoogleConnection();
    }
  }, [companyId, loadAppointments, checkGoogleConnection]);

  const events: CalendarEvent[] = useMemo(() => {
    return appointments.map((apt) => ({
      id: apt.id,
      title: apt.title,
      start: new Date(apt.startTime),
      end: new Date(apt.endTime),
      resource: apt,
    }));
  }, [appointments]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const appointment = event.resource;
    let backgroundColor = "#3b82f6";
    let borderColor = "#2563eb";

    switch (appointment.status) {
      case AppointmentStatus.SCHEDULED:
        backgroundColor = "#3b82f6";
        borderColor = "#2563eb";
        break;
      case AppointmentStatus.CONFIRMED:
        backgroundColor = "#10b981";
        borderColor = "#059669";
        break;
      case AppointmentStatus.COMPLETED:
        backgroundColor = "#6b7280";
        borderColor = "#4b5563";
        break;
      case AppointmentStatus.CANCELLED:
        backgroundColor = "#ef4444";
        borderColor = "#dc2626";
        break;
      case AppointmentStatus.NO_SHOW:
        backgroundColor = "#f59e0b";
        borderColor = "#d97706";
        break;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        borderLeft: `4px solid ${borderColor}`,
        color: "white",
        borderRadius: "4px",
        padding: "2px 5px",
        fontSize: "0.875rem",
        fontWeight: "500",
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedAppointment(event.resource);
    setShowEventDetails(true);
  }, []);

  const handleSelectSlot = useCallback(() => {
    setShowNewAppointment(true);
  }, []);

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowEventDetails(false);
    setShowEditAppointment(true);
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este agendamento?") || !companyId) return;

    try {
      await appointmentApi.delete(id, companyId);
      await loadAppointments();
      setShowEventDetails(false);
    } catch (error) {
      alert("Erro ao deletar agendamento");
    }
  };

  const handleConfirmAppointment = async (id: string) => {
    if (!companyId) return;
    try {
      await appointmentApi.update(id, companyId, { status: AppointmentStatus.CONFIRMED });
      await loadAppointments();
      setShowEventDetails(false);
    } catch (error) {
      alert("Erro ao confirmar agendamento");
    }
  };

  // ✅ Loading state inicial enquanto não temos companyId
  if (!companyId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Calendar className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados da empresa...</p>
        </div>
      </div>
    );
  }

  if (loading && appointments.length === 0) {
    return <CalendarSkeleton />;
  }

  // Calculate metrics
  const totalAppointments = appointments.length;
  const todayAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.startTime);
    const today = new Date();
    return (
      aptDate.getDate() === today.getDate() &&
      aptDate.getMonth() === today.getMonth() &&
      aptDate.getFullYear() === today.getFullYear()
    );
  });
  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.startTime);
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return aptDate >= today && aptDate <= nextWeek;
  });
  const confirmedAppointments = appointments.filter(
    (apt) => apt.status === AppointmentStatus.CONFIRMED
  );

  return (
    <div className="p-6">
      <div className={spacing.section}>
        {/* Header */}
        <div className="flex items-center justify-end gap-4 mb-6">
          {googleStatus?.connected ? (
            <button
              onClick={() => setShowGoogleCalendar(true)}
              className={badges.success + " cursor-pointer hover:shadow-sm transition-all"}
            >
              <CheckCircle className={`${icons.small} mr-1`} />
              Google Calendar Conectado
            </button>
          ) : (
            <button
              onClick={() => setShowGoogleCalendar(true)}
              className={badges.warning + " cursor-pointer hover:shadow-sm transition-all"}
            >
              <Settings className={`${icons.small} mr-1`} />
              Conectar Google Calendar
            </button>
          )}
          <button onClick={() => setShowNewAppointment(true)} className={buttons.primary}>
            <Plus className={`${icons.default} inline-block mr-2`} />
            Novo Agendamento
          </button>
        </div>

        {/* Metrics Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-4 ${spacing.cardGap} mb-8`}>
          <div className={cards.stats}>
            <div className="flex flex-col">
              <p className={typography.caption}>Total de Agendamentos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalAppointments}</p>
              <p className={`${typography.caption} mt-1`}>Todos os agendamentos</p>
            </div>
          </div>
          <div className={cards.stats}>
            <div className="flex flex-col">
              <p className={typography.caption}>Hoje</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{todayAppointments.length}</p>
              <p className={`${typography.caption} mt-1`}>Agendamentos hoje</p>
            </div>
          </div>
          <div className={cards.stats}>
            <div className="flex flex-col">
              <p className={typography.caption}>Próximos 7 dias</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{upcomingAppointments.length}</p>
              <p className={`${typography.caption} mt-1`}>Agendamentos próximos</p>
            </div>
          </div>
          <div className={cards.stats}>
            <div className="flex flex-col">
              <p className={typography.caption}>Confirmados</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{confirmedAppointments.length}</p>
              <p className={`${typography.caption} mt-1`}>Confirmados</p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className={cards.default}>
          <div className="calendar-container" style={{ height: "700px" }}>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              messages={messages}
              culture="pt-BR"
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              views={["month", "week", "day", "agenda"]}
              step={30}
              timeslots={2}
              min={new Date(2024, 0, 1, 6, 0, 0)} // 06:00
              max={new Date(2024, 0, 1, 23, 0, 0)} // 23:00
              showMultiDayTimes
              defaultDate={new Date()}
              defaultView="week"
              formats={{
                timeGutterFormat: (date, culture, localizer) =>
                  localizer?.format(date, "HH:mm", culture) || "",
                eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                  `${localizer?.format(start, "HH:mm", culture)} - ${localizer?.format(end, "HH:mm", culture)}`,
                agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
                  `${localizer?.format(start, "HH:mm", culture)} - ${localizer?.format(end, "HH:mm", culture)}`,
              }}
            />
          </div>
        </div>

        {/* Event Details Modal */}
        <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Detalhes do Agendamento
              </DialogTitle>
            </DialogHeader>

            {selectedAppointment && (
              <div className="space-y-4">
                {/* Title and Badges */}
                <div>
                  <h3 className="text-2xl font-bold mb-2">{selectedAppointment.title}</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {AppointmentTypeLabels[selectedAppointment.type]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        selectedAppointment.status === AppointmentStatus.CONFIRMED
                          ? "bg-green-50 text-green-700 border-green-200"
                          : selectedAppointment.status === AppointmentStatus.CANCELLED
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                      }
                    >
                      {AppointmentStatusLabels[selectedAppointment.status]}
                    </Badge>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Horário</p>
                      <p className="text-muted-foreground">
                        {format(new Date(selectedAppointment.startTime), "PPP 'às' HH:mm", { locale: ptBR })}
                        {" - "}
                        {format(new Date(selectedAppointment.endTime), "HH:mm")}
                      </p>
                    </div>
                  </div>

                  {selectedAppointment.customer && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Cliente</p>
                        <p className="text-muted-foreground">{selectedAppointment.customer.name}</p>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.location && (
                    <div className="flex items-center gap-2 text-sm col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Localização</p>
                        <p className="text-muted-foreground">{selectedAppointment.location}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedAppointment.description && (
                  <div>
                    <p className="font-medium mb-1">Descrição</p>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.description}</p>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div>
                    <p className="font-medium mb-1">Notas Internas</p>
                    <p className="text-sm text-muted-foreground italic">{selectedAppointment.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleEditAppointment(selectedAppointment)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  {selectedAppointment.status === AppointmentStatus.SCHEDULED && (
                    <Button
                      variant="outline"
                      onClick={() => handleConfirmAppointment(selectedAppointment.id)}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirmar
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modals */}
        <AppointmentModal
          open={showNewAppointment}
          onClose={() => setShowNewAppointment(false)}
          onSuccess={loadAppointments}
          companyId={companyId}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email ?? undefined, // Convert null to undefined
          }))}
        />

        <EditAppointmentModal
          open={showEditAppointment}
          onClose={() => setShowEditAppointment(false)}
          onSuccess={loadAppointments}
          companyId={companyId}
          appointment={selectedAppointment}
        />

        <GoogleCalendarModal
          open={showGoogleCalendar}
          onClose={() => setShowGoogleCalendar(false)}
          onSuccess={checkGoogleConnection}
          companyId={companyId}
          currentStatus={googleStatus}
        />

        {/* Custom Styles */}
        <style jsx global>{`
        .rbc-calendar {
          font-family: inherit;
          font-size: 14px;
        }

        /* Header dos dias da semana */
        .rbc-header {
          padding: 16px 8px;
          font-weight: 600;
          background-color: hsl(var(--muted));
          border-bottom: 2px solid hsl(var(--border));
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        .rbc-header + .rbc-header {
          border-left: 1px solid hsl(var(--border));
        }

        /* Dia atual destacado */
        .rbc-today {
          background-color: hsl(var(--accent) / 0.3);
        }

        .rbc-header.rbc-today {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }

        /* Eventos */
        .rbc-event {
          border-radius: 6px;
          padding: 4px 8px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: all 0.2s;
        }

        .rbc-event:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }

        .rbc-event:focus {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
        }

        .rbc-event-label {
          display: none;
        }

        .rbc-event-content {
          font-size: 12px;
          line-height: 1.4;
        }

        /* Toolbar (botões de navegação) */
        .rbc-toolbar {
          padding: 16px 0;
          gap: 12px;
        }

        .rbc-toolbar button {
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          background-color: hsl(var(--background));
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .rbc-toolbar button:hover {
          background-color: hsl(var(--accent));
          border-color: hsl(var(--primary));
        }

        .rbc-toolbar button.rbc-active {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }

        /* Visualização de mês e semana */
        .rbc-month-view,
        .rbc-time-view {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          overflow: hidden;
        }

        /* Grade de horários (Week/Day view) */
        .rbc-time-header {
          border-bottom: 2px solid hsl(var(--border));
        }

        .rbc-time-content {
          border-top: none;
        }

        .rbc-time-gutter {
          background-color: hsl(var(--muted) / 0.3);
        }

        .rbc-timeslot-group {
          min-height: 60px;
          border-bottom: 1px solid hsl(var(--border) / 0.5);
        }

        .rbc-time-slot {
          border-top: 1px dashed hsl(var(--border) / 0.3);
        }

        .rbc-current-time-indicator {
          background-color: hsl(var(--destructive));
          height: 2px;
        }

        /* Colunas dos dias */
        .rbc-day-slot {
          background-color: hsl(var(--background));
        }

        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.2);
        }

        .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid hsl(var(--border));
        }

        /* Horários na lateral */
        .rbc-label {
          padding: 0 8px;
          font-size: 12px;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
        }

        /* Visualização de agenda (lista) */
        .rbc-agenda-view {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
        }

        .rbc-agenda-table {
          border-spacing: 0;
        }

        .rbc-agenda-date-cell,
        .rbc-agenda-time-cell {
          padding: 12px;
          font-weight: 500;
          border-bottom: 1px solid hsl(var(--border));
        }

        .rbc-agenda-event-cell {
          padding: 12px;
          border-bottom: 1px solid hsl(var(--border));
        }

        /* Responsividade */
        @media (max-width: 768px) {
          .rbc-toolbar {
            flex-direction: column;
          }

          .rbc-toolbar-label {
            margin: 8px 0;
          }
        }
      `}</style>
      </div>
    </div>
  );
}