"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, CheckSquare, FileEdit, CalendarDays, Megaphone, ClipboardList, CalendarCheck } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
  { label: "Timetable", href: "/staff/timetable", icon: CalendarDays },
  { label: "Exam Timetable", href: "/staff/exams", icon: CalendarCheck },
  { label: "Assignments", href: "/staff/assignments", icon: ClipboardList },
  { label: "Attendance", href: "/staff/attendance", icon: CheckSquare },
  { label: "Marks Entry", href: "/staff/marks", icon: FileEdit },
  { label: "Announcements", href: "/staff/announcements", icon: Megaphone },
];

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sidebarItems={SIDEBAR_ITEMS} userRole="STAFF">
      {children}
    </AppShell>
  );
}
