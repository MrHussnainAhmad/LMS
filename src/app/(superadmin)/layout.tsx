"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, Users, Activity, ShieldAlert, FileText, Star } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/sa/dashboard", icon: LayoutDashboard },
  { label: "School Requests", href: "/sa/institutions", icon: Building2 },
  { label: "Featured Logos", href: "/sa/featured-institutions", icon: Star },
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
