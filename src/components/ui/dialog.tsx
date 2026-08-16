"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return (
      <DialogPrimitive.Close data-slot="dialog-close" render={children} {...props} />
    );
  }

  return <DialogPrimitive.Close data-slot="dialog-close" {...props}>{children}</DialogPrimitive.Close>;
}

interface DialogPopupProps extends React.ComponentProps<typeof DialogPrimitive.Popup> {
  className?: string;
}

function DialogPopup({ className, ...props }: DialogPopupProps) {
  return (
    <DialogPrimitive.Popup
      data-slot="dialog-popup"
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6",
        className
      )}
      {...props}
    />
  );
}

function DialogBackdrop({ ...props }: React.ComponentProps<typeof DialogPrimitive.Backdrop>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-all duration-200",
        "data-[starting-style]:opacity-0 data-[starting-style]:backdrop-blur-none",
        "data-[ending-style]:opacity-0 data-[ending-style]:backdrop-blur-none",
        "data-[open]:opacity-100 data-[open]:backdrop-blur-sm"
      )}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

interface DialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Popup> {
  className?: string;
  children: React.ReactNode;
}

function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPopup className={cn("overflow-hidden", className)} {...props}>
        <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          {children}
        </div>
      </DialogPopup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex items-start justify-between gap-4 border-b border-border p-5", className)}
      {...props}
    />
  );
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex-1 overflow-y-auto p-5", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-3 border-t border-border p-5", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogPopup,
  DialogBackdrop,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
};
