"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Users, UserSquare2, BookOpen, Calendar, Settings, MapPin, Megaphone, FilePenLine, ClipboardList } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/institution/dashboard", icon: LayoutDashboard },
  { label: "Campuses", href: "/institution/campuses", icon: MapPin },
  { label: "Staff", href: "/institution/staff", icon: UserSquare2 },
  { label: "Staff Requests", href: "/institution/staff-requests", icon: FilePenLine },
  { label: "Students", href: "/institution/students", icon: Users },
  { label: "Student Requests", href: "/institution/student-requests", icon: FilePenLine },
  { label: "Academics", href: "/institution/academics", icon: BookOpen },
  { label: "Timetable", href: "/institution/timetable", icon: Calendar },
  { label: "Exams", href: "/institution/exams", icon: ClipboardList },
  { label: "Publish Results", href: "/institution/publish-results", icon: ClipboardList },
  { label: "Announcements", href: "/institution/announcements", icon: Megaphone },
  { label: "Settings", href: "/institution/settings", icon: Settings },
];

export default function InstitutionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell sidebarItems={SIDEBAR_ITEMS} userRole="INSTITUTION">
      {children}
    </AppShell>
  );
}
