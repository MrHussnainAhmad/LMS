"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Building2, FileText, Star, Ticket, Newspaper } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/employee/dashboard", icon: LayoutDashboard },
  { label: "Verification Queue", href: "/employee/institutions", icon: Building2 },
  { label: "Featured Logos", href: "/employee/featured-institutions", icon: Star },
  { label: "Footer Pages", href: "/employee/pages", icon: FileText },
  { label: "Platform Support", href: "/employee/tickets", icon: Ticket },
  { label: "Blogs", href: "/employee/blogs", icon: Newspaper },
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
