"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Appointment,
  AppointmentStatus,
  AppointmentStatusLabels,
} from "@/types/appointment";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarViewProps {
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
}

export function CalendarView({ appointments, onAppointmentClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.startTime);
      return isSameDay(aptDate, day);
    });
  };

  const getStatusColor = (status: AppointmentStatus) => {
    const colors: Record<AppointmentStatus, string> = {
      [AppointmentStatus.SCHEDULED]: "bg-blue-100 text-blue-700 border-blue-200",
      [AppointmentStatus.CONFIRMED]: "bg-green-100 text-green-700 border-green-200",
      [AppointmentStatus.COMPLETED]: "bg-gray-100 text-gray-700 border-gray-200",
      [AppointmentStatus.CANCELLED]: "bg-red-100 text-red-700 border-red-200",
      [AppointmentStatus.NO_SHOW]: "bg-yellow-100 text-yellow-700 border-yellow-200",
    };
    return colors[status];
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {appointments.length} agendamento(s) este mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
            {/* Week day headers */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-700"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`
                    min-h-[120px] bg-white p-2 relative
                    ${!isCurrentMonth ? "bg-gray-50" : ""}
                    ${isToday ? "ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`
                        text-sm font-medium
                        ${!isCurrentMonth ? "text-gray-400" : "text-gray-900"}
                        ${isToday ? "bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </span>
                    {dayAppointments.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>

                  {/* Appointments */}
                  <div className="space-y-1 overflow-y-auto max-h-[80px]">
                    {dayAppointments.slice(0, 3).map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => onAppointmentClick(apt)}
                        className={`
                          text-xs p-1.5 rounded border cursor-pointer
                          hover:shadow-md transition-shadow
                          ${getStatusColor(apt.status)}
                        `}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="font-medium truncate">
                            {format(new Date(apt.startTime), "HH:mm")}
                          </span>
                        </div>
                        <div className="truncate font-medium">
                          {apt.title}
                        </div>
                        {apt.customer && (
                          <div className="truncate text-xs opacity-75">
                            {apt.customer.name}
                          </div>
                        )}
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayAppointments.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="text-sm font-medium text-muted-foreground">Legenda:</div>
            {Object.values(AppointmentStatus).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${getStatusColor(status)}`} />
                <span className="text-sm">{AppointmentStatusLabels[status]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
