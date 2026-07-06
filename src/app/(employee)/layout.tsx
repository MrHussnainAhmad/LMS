"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2 } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/employee/dashboard", icon: LayoutDashboard },
  { label: "Verification Queue", href: "/employee/institutions", icon: Building2 },
];

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sidebarItems={SIDEBAR_ITEMS} userRole="EMPLOYEE">
      {children}
    </AppShell>
  );
}
