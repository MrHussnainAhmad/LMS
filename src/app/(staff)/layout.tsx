"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, CheckSquare, FileEdit, CalendarDays, Megaphone, ClipboardList, CalendarCheck, FileQuestion } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
  { label: "Timetable", href: "/staff/timetable", icon: CalendarDays },
  { label: "Exam Timetable", href: "/staff/exams", icon: CalendarCheck, availabilityKey: "examTimetable" as const },
  { label: "Assignments", href: "/staff/assignments", icon: ClipboardList },
  { label: "Host Tests", href: "/staff/tests", icon: FileQuestion },
  { label: "Attendance", href: "/staff/attendance", icon: CheckSquare },
  { label: "Marks Entry", href: "/staff/marks", icon: FileEdit },
  { label: "Batch Results", href: "/batch-results", icon: ClipboardList },
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
