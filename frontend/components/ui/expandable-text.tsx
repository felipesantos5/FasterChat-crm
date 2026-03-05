"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  limit?: number;
  className?: string;
}

export function ExpandableText({
  text,
  limit = 150,
  className = ""
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  const isLongText = text.length > limit;

  if (!isLongText) {
    return <p className={className}>{text}</p>;
  }

  const displayedText = isExpanded ? text : `${text.substring(0, limit)}...`;

  return (
    <div className="space-y-1">
      <div className={className + " whitespace-pre-wrap break-words overflow-hidden"}>
        {displayedText}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1 transition-colors mt-1 focus:outline-none"
      >
        {isExpanded ? "Ver menos" : "Ver mais"}
      </button>
    </div>
  );
}
