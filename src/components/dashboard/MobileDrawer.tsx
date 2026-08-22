"use client";

import { useSidebar } from "@/hooks/useSidebar";
import { useSession } from "@/hooks/useSession";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export function MobileDrawer() {
  const { isOpen, setIsOpen, isMobile } = useSidebar();
  const { session } = useSession();
  const role = (session?.user?.role || "rondier") as
    | "admin"
    | "superviseur"
    | "chef-de-quart"
    | "chef-de-bloc"
    | "rondier";

  if (!isMobile) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>NexaFlow</SheetTitle>
          <SheetDescription>Navigation mobile</SheetDescription>
        </SheetHeader>
        <div className="h-[calc(100%-4rem)] overflow-y-auto">
          <DashboardSidebar role={role} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
