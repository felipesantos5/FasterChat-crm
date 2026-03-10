"use client";

import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Search, Type, ImageIcon, Mic, Settings, Loader2, ChevronRight } from "lucide-react";
import { QuickMessage } from "@/types/quick-message";
import { quickMessageApi } from "@/lib/quick-message";
import Link from "next/link";

interface QuickMessagePopoverProps {
  disabled?: boolean;
  onSelectText: (text: string) => void;
  onSelectMedia: (base64: string, caption?: string) => void;
  onSelectAudio: (base64: string) => void;
}

const typeIcon = {
  TEXT: <Type className="h-3.5 w-3.5 text-blue-500 shrink-0" />,
  MEDIA: <ImageIcon className="h-3.5 w-3.5 text-purple-500 shrink-0" />,
  AUDIO: <Mic className="h-3.5 w-3.5 text-green-500 shrink-0" />,
};

const typeLabel = {
  TEXT: "Texto",
  MEDIA: "Mídia",
  AUDIO: "Áudio",
};

export function QuickMessagePopover({
  disabled,
  onSelectText,
  onSelectMedia,
  onSelectAudio,
}: QuickMessagePopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    quickMessageApi
      .findAll()
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = messages.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.type === "TEXT" && m.content.toLowerCase().includes(search.toLowerCase()))
  );

  function handleSelect(msg: QuickMessage) {
    setOpen(false);
    setSearch("");
    if (msg.type === "TEXT") {
      onSelectText(msg.content);
    } else if (msg.type === "MEDIA") {
      onSelectMedia(msg.content, msg.caption ?? undefined);
    } else {
      onSelectAudio(msg.content);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="Mensagens rápidas"
          className="rounded-full"
        >
          <Zap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-0 rounded-xl shadow-lg border border-border overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border bg-muted/40">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            Mensagens Rápidas
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar mensagem..."
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {messages.length === 0
                  ? "Nenhuma mensagem rápida cadastrada."
                  : "Nenhum resultado."}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => handleSelect(msg)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent transition-colors text-left group"
                >
                  <div className="shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                    {typeIcon[msg.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{msg.title}</p>
                    {msg.type === "TEXT" && (
                      <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
                    )}
                    {msg.type !== "TEXT" && (
                      <p className="text-xs text-muted-foreground">{typeLabel[msg.type]}</p>
                    )}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 bg-muted/40">
          <Link
            href="/dashboard/configuracoes/mensagens-rapidas"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            Gerenciar mensagens rápidas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
