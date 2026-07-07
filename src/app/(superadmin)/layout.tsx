"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Users, Activity, ShieldAlert, FileText } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/sa/dashboard", icon: LayoutDashboard },
  { label: "Institutions", href: "/sa/institutions", icon: Building2 },
  { label: "Employees", href: "/sa/employees", icon: Users },
  { label: "System Admins", href: "/sa/admins", icon: ShieldAlert },
  { label: "Audit Logs", href: "/sa/audit", icon: Activity },
  { label: "Footer Pages", href: "/sa/pages", icon: FileText },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sidebarItems={SIDEBAR_ITEMS} userRole="SUPER_ADMIN">
      {children}
    </AppShell>
  );
}
