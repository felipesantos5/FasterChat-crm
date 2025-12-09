"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateTimePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecione data e hora",
  disabled = false,
  minDate,
  className,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(value, "HH:mm") : ""
  )
  const [isOpen, setIsOpen] = React.useState(false)

  // Sincroniza com value externo
  React.useEffect(() => {
    if (value) {
      setSelectedDate(value)
      setTimeValue(format(value, "HH:mm"))
    } else {
      setSelectedDate(undefined)
      setTimeValue("")
    }
  }, [value])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Mantém a hora atual se já tiver uma selecionada
      if (timeValue) {
        const [hours, minutes] = timeValue.split(":").map(Number)
        date.setHours(hours, minutes, 0, 0)
      } else {
        // Define hora padrão como 09:00 se não tiver hora selecionada
        date.setHours(9, 0, 0, 0)
        setTimeValue("09:00")
      }
      setSelectedDate(date)
      onChange(date)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value
    setTimeValue(time)

    if (selectedDate && time) {
      const [hours, minutes] = time.split(":").map(Number)
      const newDate = new Date(selectedDate)
      newDate.setHours(hours, minutes, 0, 0)
      setSelectedDate(newDate)
      onChange(newDate)
    }
  }

  const handleClear = () => {
    setSelectedDate(undefined)
    setTimeValue("")
    onChange(undefined)
  }

  // Calcula a data mínima (hoje por padrão, ou minDate se fornecido)
  const effectiveMinDate = minDate || new Date()
  effectiveMinDate.setHours(0, 0, 0, 0)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? (
              format(selectedDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 space-y-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < effectiveMinDate}
              locale={ptBR}
              initialFocus
            />

            {/* Seletor de Hora */}
            <div className="border-t pt-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="time" className="text-sm font-medium">
                  Horário
                </Label>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  id="time"
                  type="time"
                  value={timeValue}
                  onChange={handleTimeChange}
                  className="flex-1"
                  disabled={!selectedDate}
                />
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Fuso horário: Brasil (Brasília)
              </p>
            </div>

            {/* Botão de Confirmar */}
            <div className="border-t pt-3">
              <Button
                className="w-full"
                onClick={() => setIsOpen(false)}
                disabled={!selectedDate || !timeValue}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Preview da data selecionada */}
      {selectedDate && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          A campanha será disparada em{" "}
          <span className="font-medium">
            {format(selectedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {" "}(horário de Brasília)
        </div>
      )}
    </div>
  )
}
