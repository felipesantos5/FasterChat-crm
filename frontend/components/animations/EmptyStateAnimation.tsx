"use client";

import { memo, useCallback, useRef, useState } from "react";

interface EmptyStateAnimationProps {
  title?: string;
  description?: string;
}

/**
 * Empty state animado com cursor tracking.
 * O personagem "olha" para onde o cursor está.
 *
 * Infraestrutura Rive pronta:
 * <RiveIcon src="/animations/empty-state.riv" stateMachine="Cursor_State" />
 */
export const EmptyStateAnimation = memo(function EmptyStateAnimation({
  title = "Nenhuma conversa",
  description = "Selecione uma conversa para começar",
}: EmptyStateAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyes, setEyes] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    // Limita o movimento dos olhos a ±3px
    setEyes({ x: dx * 3, y: dy * 3 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center h-full p-4 text-center select-none"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setEyes({ x: 0, y: 0 }); }}
    >
      {/* SVG do personagem */}
      <div
        className="mb-4 transition-transform duration-300"
        style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
      >
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Halo / brilho de fundo */}
          <circle cx="40" cy="40" r="36" fill="#ede9fe" className="animate-pulse" style={{ animationDuration: "3s" }} />

          {/* Corpo do balão de chat */}
          <rect x="14" y="16" width="52" height="38" rx="10" fill="#7c3aed" fillOpacity="0.12" stroke="#7c3aed" strokeWidth="1.5" />
          <path d="M28 54l-8 8 2-8" fill="#7c3aed" fillOpacity="0.12" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" />

          {/* Olho esquerdo */}
          <circle cx="30" cy="35" r="5.5" fill="white" />
          <circle cx="30" cy="35" r="3" fill="#7c3aed" />
          <circle
            cx={30 + eyes.x}
            cy={35 + eyes.y}
            r="1.8"
            fill="#1e1b4b"
            style={{ transition: "cx 0.1s, cy 0.1s" }}
          />
          <circle cx={30 + eyes.x - 0.6} cy={35 + eyes.y - 0.6} r="0.5" fill="white" />

          {/* Olho direito */}
          <circle cx="50" cy="35" r="5.5" fill="white" />
          <circle cx="50" cy="35" r="3" fill="#7c3aed" />
          <circle
            cx={50 + eyes.x}
            cy={35 + eyes.y}
            r="1.8"
            fill="#1e1b4b"
            style={{ transition: "cx 0.1s, cy 0.1s" }}
          />
          <circle cx={50 + eyes.x - 0.6} cy={35 + eyes.y - 0.6} r="0.5" fill="white" />

          {/* Boca — sorri se hovered */}
          {isHovered ? (
            <path d="M33 46 Q40 52 47 46" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M34 46 Q40 50 46 46" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          )}

          {/* Pontinhos decorativos de "mensagem" */}
          <circle cx="40" cy="24" r="1.5" fill="#7c3aed" fillOpacity="0.3" />
          <circle cx="47" cy="24" r="1.5" fill="#7c3aed" fillOpacity="0.2" />
          <circle cx="33" cy="24" r="1.5" fill="#7c3aed" fillOpacity="0.2" />
        </svg>
      </div>

      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[160px] leading-relaxed">{description}</p>
    </div>
  );
});
