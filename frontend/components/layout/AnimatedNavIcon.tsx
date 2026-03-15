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

    const wasActive = prevActiveRef.current;
    prevActiveRef.current = isActive;

    // Transição inativo → ativo: animação normal
    if (isActive && !wasActive) {
      const animClass = `nav-icon-${animation}`;
      el.classList.remove(animClass, `nav-icon-${animation}-reverse`);
      void el.offsetWidth;
      el.classList.add(animClass);
      const handleEnd = () => el.classList.remove(animClass);
      el.addEventListener("animationend", handleEnd, { once: true });
    }

    // Transição ativo → inativo: animação reversa (apenas para spin)
    if (!isActive && wasActive && animation === "spin") {
      const reverseClass = `nav-icon-${animation}-reverse`;
      el.classList.remove(`nav-icon-${animation}`, reverseClass);
      void el.offsetWidth;
      el.classList.add(reverseClass);
      const handleEnd = () => el.classList.remove(reverseClass);
      el.addEventListener("animationend", handleEnd, { once: true });
    }
  }, [isActive, animation]);

  return (
    <span ref={spanRef} className={cn("inline-flex items-center justify-center", className)}>
      <Icon />
    </span>
  );
}
