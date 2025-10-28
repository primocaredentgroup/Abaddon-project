"use client";

import React from "react";

interface PriorityLevelProps {
  value: number; // 1-5
  onChange?: (value: number) => void;
  readonly?: boolean;
  showLabel?: boolean;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Molto Bassa",
  2: "Bassa",
  3: "Media",
  4: "Alta",
  5: "Urgente",
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-gray-400",
  2: "text-gray-500",
  3: "text-orange-400",
  4: "text-orange-600",
  5: "text-red-600",
};

export const PriorityLevel: React.FC<PriorityLevelProps> = ({
  value,
  onChange,
  readonly = false,
  showLabel = true,
}) => {
  const handleClick = (level: number) => {
    if (!readonly && onChange) {
      onChange(level);
    }
  };

  const renderFlame = (level: number) => {
    const isActive = level <= value;
    // Fiamme attive: colore pieno; Fiamme inattive: grigio molto chiaro (quasi trasparenti)
    const colorClass = isActive ? PRIORITY_COLORS[value] : "text-gray-200 opacity-40";
    const cursorClass = readonly ? "cursor-default" : "cursor-pointer hover:scale-110 transition-transform";

    return (
      <span
        key={level}
        className={`text-2xl ${colorClass} ${cursorClass}`}
        onClick={() => handleClick(level)}
        role={readonly ? "img" : "button"}
        aria-label={`Priorità ${level}`}
      >
        🔥
      </span>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(renderFlame)}
      </div>
      {showLabel && (
        <span className={`text-sm font-medium ${PRIORITY_COLORS[value]}`}>
          {PRIORITY_LABELS[value]}
        </span>
      )}
    </div>
  );
};

