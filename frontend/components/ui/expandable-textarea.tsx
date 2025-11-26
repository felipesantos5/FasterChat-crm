'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
  description?: string;
}

export function ExpandableTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
  className,
  label,
  description,
}: ExpandableTextareaProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize baseado no conteúdo
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !isExpanded) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = rows * 24; // aproximadamente 24px por linha
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [value, rows, isExpanded]);

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 text-xs"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3 w-3 mr-1" />
                Minimizar
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3 mr-1" />
                Expandir
              </>
            )}
          </Button>
        </div>
      )}

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div
        className={cn(
          'relative transition-all duration-200',
          isExpanded && 'fixed inset-4 z-50 bg-background/95 backdrop-blur-sm p-6 rounded-lg border shadow-2xl'
        )}
      >
        {isExpanded && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              {label && <h3 className="text-lg font-semibold">{label}</h3>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(false)}
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Fechar
            </Button>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={isExpanded ? 20 : rows}
          className={cn(
            'transition-all',
            isExpanded ? 'min-h-[calc(100vh-200px)] text-base' : 'resize-none',
            className
          )}
        />

        {isExpanded && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{value.length} caracteres</span>
            <span>{value.split('\n').length} linhas</span>
          </div>
        )}
      </div>

      {/* Overlay quando expandido */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
}
