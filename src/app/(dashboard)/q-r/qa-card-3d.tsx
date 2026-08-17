"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QAPairWithRegistry } from "@/lib/qr/client-store";

interface QACard3DProps {
  item: QAPairWithRegistry;
  index: number;
  onEdit: (item: QAPairWithRegistry) => void;
  onDelete: (id: number) => void;
}

export function QACard3D({ item, index, onEdit, onDelete }: QACard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4;
    const rotateY = ((x - centerX) / centerX) * 4;
    card.style.setProperty("--rotateX", `${rotateX}deg`);
    card.style.setProperty("--rotateY", `${rotateY}deg`);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.setProperty("--rotateX", "0deg");
    card.style.setProperty("--rotateY", "0deg");
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      className={cn(
        "tilt-card relative rounded-2xl",
        "animate-card-enter"
      )}
      style={{
        animationDelay: `${index * 60}ms`,
        transform:
          "perspective(1000px) rotateX(var(--rotateX, 0deg)) rotateY(var(--rotateY, 0deg))",
      }}
    >
      {/* Glow backdrop on hover */}
      <div
        className={cn(
          "absolute -inset-[1px] rounded-2xl transition-all duration-500 blur-xl pointer-events-none",
          "bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Card body */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-card/70 backdrop-blur-xl",
          "border border-white/10 dark:border-white/5",
          "shadow-lg",
          "transition-shadow duration-300",
          isHovered ? "shadow-2xl shadow-purple-500/10" : ""
        )}
      >
        {/* Shimmer sweep on hover */}
        <div
          className={cn(
            "absolute inset-0 -translate-x-full pointer-events-none",
            "bg-gradient-to-r from-transparent via-white/10 to-transparent",
            "transition-transform duration-1000 ease-in-out",
            isHovered ? "translate-x-full" : ""
          )}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5">
          <div className="flex-1 space-y-4">
            {/* Question */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  "bg-blue-500/15 border border-blue-500/25",
                  "text-blue-400"
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400/80">
                  Question
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {item.question}
                </p>
              </div>
            </div>

            {/* Answer */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  "bg-purple-500/15 border border-purple-500/25",
                  "text-purple-400"
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/80">
                  Réponse
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            </div>

            {item.registry && (
              <p className="text-xs text-muted-foreground/60 pl-11">
                — {item.registry.title}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className={cn(
            "flex sm:flex-col items-center gap-1 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-50"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(item)}
              aria-label="Modifier"
              className="h-8 w-8 rounded-lg hover:bg-white/10 hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(item.id)}
              aria-label="Supprimer"
              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
