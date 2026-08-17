"use client";

import { Toaster as SonnerToaster } from "sonner";
import type { ToasterProps } from "sonner";
import { CheckCircle2, XCircle, Info, Loader2, X } from "lucide-react";

const toastStyles = {
  toast:
    "group/toast relative flex items-center gap-3 w-full max-w-sm rounded-xl border border-white/10 bg-white/80 px-4 py-3.5 text-sm font-medium text-foreground shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.18)] dark:bg-foreground/90 dark:text-background dark:border-white/5 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]",
  title: "flex-1 leading-snug",
  description:
    "text-xs text-muted-foreground dark:text-muted-foreground/80 leading-relaxed mt-0.5",
  closeButton:
    "absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity duration-200 hover:bg-foreground/5 hover:text-foreground group-hover/toast:opacity-100 dark:hover:bg-background/10",
  success:
    "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400",
  error:
    "border-l-[3px] border-l-red-500 dark:border-l-red-400",
  info:
    "border-l-[3px] border-l-sky-500 dark:border-l-sky-400",
  warning:
    "border-l-[3px] border-l-amber-500 dark:border-l-amber-400",
  loading:
    "border-l-[3px] border-l-violet-500 dark:border-l-violet-400",
  default:
    "border-l-[3px] border-l-foreground/30 dark:border-l-background/30",
  actionButton:
    "inline-flex items-center justify-center rounded-lg bg-foreground/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-foreground/10 dark:bg-background/10 dark:hover:bg-background/20",
  cancelButton:
    "inline-flex items-center justify-center rounded-lg bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 dark:hover:bg-background/10",
} as const;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      toastOptions={{
        unstyled: false,
        classNames: toastStyles,
        duration: 4000,
      }}
      icons={{
        success: (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ),
        error: (
          <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        ),
        info: (
          <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
        ),
        warning: (
          <Info className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        ),
        loading: (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-600 dark:text-violet-400" />
        ),
        close: (
          <X className="h-4 w-4 shrink-0" />
        ),
      }}
      position="top-right"
      theme="system"
      expand={true}
      closeButton
      visibleToasts={3}
      {...props}
    />
  );
}
