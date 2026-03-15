"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Share2 } from "lucide-react";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { useCustomers } from "@/hooks/use-customers";
import { messageApi } from "@/lib/message";
import { toast } from "sonner";
import type { Message } from "@/types/message";

interface ForwardMessageModalProps {
  open: boolean;
  onClose: () => void;
  message: Message | null;
  companyId: string;
}

export function ForwardMessageModal({ open, onClose, message, companyId }: ForwardMessageModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const { customers, isLoading } = useCustomers(companyId);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [customers, search]);

  function toggle(customerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  async function handleSend() {
    if (!message || selected.size === 0) return;
    setSending(true);
    try {
      const result = await messageApi.forwardMessage(message.id, Array.from(selected));
      toast.success(
        result.data.successCount === selected.size
          ? `Mensagem encaminhada para ${result.data.successCount} contato${result.data.successCount > 1 ? "s" : ""}`
          : `Encaminhada para ${result.data.successCount} de ${selected.size} contato${selected.size > 1 ? "s" : ""}`
      );
      handleClose();
    } catch {
      toast.error("Falha ao encaminhar mensagem");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setSearch("");
    setSelected(new Set());
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" />
            Encaminhar mensagem
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <ScrollArea className="h-[340px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum contato encontrado
            </p>
          ) : (
            <div className="flex flex-col py-1">
              {filtered.map((customer) => {
                const isSelected = selected.has(customer.id);
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => toggle(customer.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent",
                      isSelected && "bg-primary/10 hover:bg-primary/15"
                    )}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}
                    />

                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={customer.profilePicUrl ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {customer.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatPhoneNumber(customer.phone)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} contato${selected.size > 1 ? "s" : ""} selecionado${selected.size > 1 ? "s" : ""}`
              : "Selecione os contatos"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={sending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Enviar para {selected.size > 0 ? selected.size : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
