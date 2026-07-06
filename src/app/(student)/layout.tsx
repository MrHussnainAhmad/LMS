"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, CalendarDays, FileText, CheckSquare, UploadCloud, CalendarCheck, FileQuestion } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Timetable", href: "/student/timetable", icon: CalendarDays },
  { label: "Exam Timetable", href: "/student/exams", icon: CalendarCheck, availabilityKey: "examTimetable" as const },
  { label: "Tests", href: "/student/tests", icon: FileQuestion, availabilityKey: "studentTests" as const },
  { label: "Attendance", href: "/student/attendance", icon: CheckSquare },
  { label: "Marks", href: "/student/marks", icon: FileText },
  { label: "Submissions", href: "/student/submissions", icon: UploadCloud },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sidebarItems={SIDEBAR_ITEMS} userRole="STUDENT">
      {children}
    </AppShell>
  );
}
