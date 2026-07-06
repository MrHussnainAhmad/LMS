"use client";

import React, { useState } from "react";
import { Sidebar, SidebarItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
  userRole: string;
}

export function AppShell({ children, sidebarItems, userRole }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform bg-surface border-r border-border transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar items={sidebarItems} role={userRole} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} role={userRole} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
