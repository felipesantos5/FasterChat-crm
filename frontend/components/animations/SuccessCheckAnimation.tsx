"use client";

import { memo, useEffect, useState } from "react";

interface SuccessCheckAnimationProps {
  /** Controla se a animação está visível */
  visible: boolean;
  size?: number;
  color?: string;
  /** Callback chamado após a animação terminar (para remover o componente) */
  onDone?: () => void;
}

/**
 * Checkmark animado — SVG que se desenha e faz "pop".
 * Use para confirmação de mensagem enviada, agendamento confirmado, etc.
 *
 * Exemplo de uso:
 *   const [showCheck, setShowCheck] = useState(false);
 *   <SuccessCheckAnimation visible={showCheck} onDone={() => setShowCheck(false)} />
 *
 * Infraestrutura Rive pronta:
 *   <RiveIcon src="/animations/success-check.riv" stateMachine="Check_State" />
 */
export const SuccessCheckAnimation = memo(function SuccessCheckAnimation({
  visible,
  size = 48,
  color = "#16a34a",
  onDone,
}: SuccessCheckAnimationProps) {
  const [phase, setPhase] = useState<"hidden" | "pop" | "draw" | "done">("hidden");

  useEffect(() => {
    if (!visible) { setPhase("hidden"); return; }

    setPhase("pop");
    const t1 = setTimeout(() => setPhase("draw"), 80);
    const t2 = setTimeout(() => { setPhase("done"); onDone?.(); }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, onDone]);

  if (phase === "hidden") return null;

  const circleR = size / 2 - 3;
  const circumference = 2 * Math.PI * circleR;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transform: phase === "pop" ? "scale(1.35)" : "scale(1)",
        transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Círculo de fundo que aparece */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={circleR}
          fill={color}
          fillOpacity="0.12"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={phase === "pop" ? circumference : 0}
          style={{
            transition: "stroke-dashoffset 0.45s ease-out",
            transformOrigin: "center",
            transform: "rotate(-90deg)",
          }}
        />

        {/* Checkmark que se desenha */}
        <path
          d={`M ${size * 0.28} ${size * 0.5} L ${size * 0.44} ${size * 0.64} L ${size * 0.72} ${size * 0.36}`}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="40"
          strokeDashoffset={phase === "pop" ? "40" : "0"}
          style={{ transition: "stroke-dashoffset 0.35s ease-out 0.25s" }}
        />
      </svg>
    </div>
  );
});
