"use client";

import React, { useState } from "react";
import { Sidebar, SidebarItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ShellBrand } from "./BrandMark";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
  userRole: string;
}

type NavAvailability = Partial<Record<NonNullable<SidebarItem["availabilityKey"] | SidebarItem["notificationKey"]>, boolean>>;

export function AppShell({ children, sidebarItems, userRole }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [navAvailability, setNavAvailability] = useState<NavAvailability>({});
  const [brand, setBrand] = useState<ShellBrand>({
    name: "Nisaab360",
    logoKey: null,
    href: "/",
    isInstitutionBrand: false,
  });

  React.useEffect(() => {
    let ignore = false;

    fetch("/api/me/brand")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ShellBrand | null) => {
        if (!ignore && data) {
          setBrand(data);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  React.useEffect(() => {
    let ignore = false;

    fetch("/api/me/nav-availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NavAvailability | null) => {
        if (!ignore && data) {
          setNavAvailability(data);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  const visibleSidebarItems = sidebarItems
    .map((item) => ({
      ...item,
      hasNotification: item.notificationKey ? navAvailability[item.notificationKey] : item.hasNotification,
    }))
    .filter((item) => (
      !item.availabilityKey || navAvailability[item.availabilityKey] === true
    ));

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
        "fixed inset-y-0 left-0 z-50 transform bg-surface border-r border-border transition-all duration-200 ease-in-out lg:static lg:translate-x-0",
        isSidebarCollapsed ? "lg:w-20" : "lg:w-64",
        "w-64",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar
          items={visibleSidebarItems}
          role={userRole}
          brand={brand}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} role={userRole} brand={brand} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
