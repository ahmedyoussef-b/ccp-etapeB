"use client"

import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  delayDuration?: number
  className?: string
}

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delayDuration = 300,
  className,
}: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        className={cn(
          "pointer-events-none absolute z-50 hidden rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md",
          "group-hover:flex group-focus-within:flex",
          side === "top" && "bottom-full mb-1.5",
          side === "bottom" && "top-full mt-1.5",
          side === "left" && "right-full mr-1.5",
          side === "right" && "left-full ml-1.5",
          align === "start" && "justify-start",
          align === "center" && "justify-center",
          align === "end" && "justify-end",
          className
        )}
        style={{ transitionDelay: `${delayDuration}ms` }}
      >
        {content}
      </div>
    </div>
  )
}

export function TooltipTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function TooltipContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
