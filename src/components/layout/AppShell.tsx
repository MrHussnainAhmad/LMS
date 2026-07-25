"use client";

import React, { useState } from "react";
import { Sidebar, SidebarItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ShellBrand } from "./BrandMark";
import { cn } from "@/lib/utils";
import { clearShellClientCache, writeShellClientCache, shellCacheKey } from "@/lib/shell-client-cache";

interface AppShellProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
  userRole: string;
  /** Optional stable ids for scoped client brand cache (safe metadata only). */
  userId?: number;
  institutionId?: number | null;
  /** When provided by an RSC layout, skip the /api/me/brand client round-trip. */
  initialBrand?: ShellBrand;
}

const DEFAULT_BRAND: ShellBrand = {
  name: "Nisaab360",
  logoKey: null,
  href: "/",
  isInstitutionBrand: false,
};

export function AppShell({
  children,
  sidebarItems,
  userRole,
  userId,
  institutionId,
  initialBrand,
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [brand] = useState<ShellBrand>(() => initialBrand ?? DEFAULT_BRAND);

  React.useEffect(() => {
    if (!initialBrand || userId == null) return;
    writeShellClientCache(
      shellCacheKey({ role: userRole, userId, institutionId, key: "brand" }),
      initialBrand
    );
  }, [initialBrand, userId, institutionId, userRole]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 transform bg-surface border-r border-border transition-all duration-200 ease-in-out lg:static lg:translate-x-0",
          isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
          "w-64",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          items={sidebarItems}
          role={userRole}
          brand={brand}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onMenuClick={() => setIsSidebarOpen(true)}
          role={userRole}
          brand={brand}
          onLogoutStart={clearShellClientCache}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
