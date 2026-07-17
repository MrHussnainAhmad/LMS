"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Button } from "../ui/button";
import { BrandMark, ShellBrand } from "./BrandMark";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  availabilityKey?: "studentTests" | "examTimetable" | "feeVouchers";
  notificationKey?: "staffLeaves" | "institutionLeaves";
  hasNotification?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  role: string;
  brand: ShellBrand;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ items, role, brand, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className={cn("h-16 flex items-center justify-between border-b border-border", isCollapsed ? "px-4 lg:justify-center" : "px-6")}>
        <Link
          href={brand.href}
          className={cn("flex min-w-0 items-center gap-2", isCollapsed && "lg:justify-center")}
          onClick={onClose}
          title={brand.name}
        >
          <BrandMark brand={brand} />
          <span className={cn("truncate font-display font-semibold text-lg text-brand-900 tracking-tight", isCollapsed && "lg:hidden")}>
            {brand.name}
          </span>
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className={cn("border-b border-border bg-stone-50/50", isCollapsed ? "px-3 py-3" : "px-4 py-3")}>
        <span className={cn("text-xs font-medium uppercase tracking-wider text-stone-500", isCollapsed && "lg:hidden")}>
          {role.replace('_', ' ')} Portal
        </span>
        {isCollapsed && <span className="hidden text-center text-xs font-bold text-stone-500 lg:block">{role.slice(0, 2)}</span>}
      </div>

      <nav className={cn("flex-1 overflow-y-auto space-y-1", isCollapsed ? "p-3" : "p-4")}>
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md text-sm font-medium transition-all group",
                isCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                isActive 
                  ? "bg-brand-50 text-brand-900" 
                  : "text-stone-600 hover:bg-stone-50 hover:text-brand-900"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5 stroke-[1.5px]", isActive ? "text-brand-700" : "text-stone-400 group-hover:text-brand-600")} />
                {item.hasNotification && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </div>
              <span className={cn(isCollapsed && "lg:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden border-t border-border p-3 lg:block">
        <Button
          type="button"
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          className={cn("w-full gap-2", isCollapsed && "px-0")}
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand menu" : "Collapse menu"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className={cn(isCollapsed && "hidden")}>Collapse</span>
        </Button>
      </div>
    </div>
  );
}
