"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LayoutDashboard, Users, UserSquare2, BookOpen, Calendar, Settings, MapPin, Megaphone, FilePenLine, ClipboardList, CheckSquare, ShieldCheck, Ticket } from "lucide-react";

const SIDEBAR_ITEMS = [
  { label: "Dashboard", href: "/institution/dashboard", icon: LayoutDashboard },
  { label: "Daily Diary", href: "/institution/diary", icon: BookOpen },
  { label: "Campuses", href: "/institution/campuses", icon: MapPin },
  { label: "Academics", href: "/institution/academics", icon: BookOpen },
  { label: "Staff", href: "/institution/staff", icon: UserSquare2 },
  { label: "Students", href: "/institution/students", icon: Users },
  { label: "Teacher's Attendance", href: "/institution/staff-attendance", icon: CheckSquare },
  { label: "Leaves", href: "/institution/staff-leaves", icon: Calendar, notificationKey: "institutionLeaves" as const },
  { label: "Timetable", href: "/institution/timetable", icon: Calendar },
  { label: "Exams", href: "/institution/exams", icon: ClipboardList },
  { label: "Announcements", href: "/institution/announcements", icon: Megaphone },
  { label: "Admins", href: "/institution/admins", icon: ShieldCheck },
  { label: "Helpdesk", href: "/institution/helpdesk", icon: Ticket },
  { label: "Settings", href: "/institution/settings", icon: Settings },
];

export default function InstitutionLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "INSTITUTION" | "INSTITUTION_ADMIN";
}) {
  const filteredItems = SIDEBAR_ITEMS.filter(item => {
    if (role === "INSTITUTION_ADMIN") {
      return item.label !== "Settings" && item.label !== "Admins";
    }
    return true;
  });

  return (
    <AppShell sidebarItems={filteredItems} userRole={role}>
      {children}
    </AppShell>
  );
}
