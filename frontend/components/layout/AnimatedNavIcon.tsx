"use client";

import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavIconAnimation =
  | "spring-pop"
  | "bounce-up"
  | "drop-in"
  | "flip-x"
  | "wiggle"
  | "snap"
  | "pulse-out"
  | "spin"
  | "heartbeat"
  | "zap";

interface AnimatedNavIconProps {
  icon: LucideIcon;
  isActive: boolean;
  animation: NavIconAnimation;
  className?: string;
}

/**
 * Wrapper de ícone Lucide que dispara uma animação CSS toda vez que
 * o item de navegação passa de inativo → ativo (false → true).
 * A animação toca uma vez e o ícone volta ao estado estático.
 */
export function AnimatedNavIcon({
  icon: Icon,
  isActive,
  animation,
  className,
}: AnimatedNavIconProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevActiveRef = useRef(false);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // Só anima na transição inativo → ativo
    if (isActive && !prevActiveRef.current) {
      const animClass = `nav-icon-${animation}`;

      // Remove a classe (caso ainda esteja rodando), força reflow e re-adiciona
      // para garantir que a animação sempre replaye do início
      el.classList.remove(animClass);
      void el.offsetWidth; // força reflow
      el.classList.add(animClass);

      // Remove a classe ao terminar para não acumular
      const handleEnd = () => el.classList.remove(animClass);
      el.addEventListener("animationend", handleEnd, { once: true });
    }

    prevActiveRef.current = isActive;
  }, [isActive, animation]);

  return (
    <span ref={spanRef} className={cn("inline-flex items-center justify-center", className)}>
      <Icon />
    </span>
  );
}
