"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon, BookOpen, X } from "lucide-react";
import { Button } from "../ui/button";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: SidebarItem[];
  role: string;
  onClose: () => void;
}

export function Sidebar({ items, role, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="h-16 flex items-center justify-between px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <BookOpen className="h-6 w-6 text-brand-800" />
          <span className="font-display font-semibold text-lg text-brand-900 tracking-tight">LMS</span>
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-border bg-stone-50/50">
        <span className="text-xs font-medium uppercase tracking-wider text-stone-500">
          {role.replace('_', ' ')} Portal
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group",
                isActive 
                  ? "bg-brand-50 text-brand-900" 
                  : "text-stone-600 hover:bg-stone-50 hover:text-brand-900"
              )}
            >
              <item.icon className={cn("h-5 w-5 stroke-[1.5px]", isActive ? "text-brand-700" : "text-stone-400 group-hover:text-brand-600")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
