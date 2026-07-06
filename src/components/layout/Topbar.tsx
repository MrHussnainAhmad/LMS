"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Bell, User, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { BrandMark, ShellBrand } from "./BrandMark";

type NotificationAnnouncement = {
  id: number;
  title: string;
  content: string;
  targetType: string;
  senderRole: string;
  createdAtLabel: string;
  isRead: boolean;
};

interface TopbarProps {
  onMenuClick: () => void;
  role: string;
  brand: ShellBrand;
}

export function Topbar({ onMenuClick, role, brand }: TopbarProps) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<NotificationAnnouncement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);

  const loadAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    try {
      const res = await api.get<{ announcements: NotificationAnnouncement[]; unreadCount: number }>("/api/announcements/notifications");
      setAnnouncements(res.announcements);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error(err);
      setAnnouncements([]);
      setUnreadCount(0);
    } finally {
      setIsLoadingAnnouncements(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await api.post(`/api/announcements/${id}/read`, {});
      setAnnouncements((current) => current.map((announcement) => (
        announcement.id === id ? { ...announcement, isRead: true } : announcement
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", {});
      router.push("/login");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-surface z-30">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden text-stone-600" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <Link href={brand.href} className="flex min-w-0 items-center gap-2" title={brand.name}>
          <BrandMark brand={brand} className="h-8 w-8" iconClassName="h-4 w-4" />
          <span className="hidden max-w-[42vw] truncate font-display text-sm font-semibold text-brand-950 sm:block lg:max-w-[28rem]">
            {brand.name}
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu onOpenChange={(open) => open && loadAnnouncements()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-stone-500 relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-danger border-2 border-surface" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel>Announcements</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoadingAnnouncements ? (
              <div className="px-3 py-6 text-center text-sm text-stone-500">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-stone-500">No announcements.</div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="rounded-sm p-3 hover:bg-stone-50">
                    <div className="flex items-start gap-2">
                      {!announcement.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-danger shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-brand-950 truncate">{announcement.title}</p>
                        <p className="text-xs text-stone-500">{announcement.senderRole} - {announcement.createdAtLabel}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-stone-600">{announcement.content}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={announcement.isRead}
                        onClick={() => markRead(announcement.id)}
                      >
                        {announcement.isRead ? "Read" : "Mark as read"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => router.push(`/announcements/${announcement.id}`)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-stone-100">
              <User className="h-5 w-5 text-stone-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              let path = "/";
              if (role === "SUPER_ADMIN") path = "/sa/admins";
              else if (role === "INSTITUTION") path = "/institution/settings";
              else if (role === "STAFF") path = "/staff/profile";
              else if (role === "STUDENT") path = "/student/profile";
              else path = `/${role.toLowerCase().replace('_', '')}/dashboard`;
              router.push(path);
            }}>
              <User className="mr-2 h-4 w-4" />
              <span>
                {role === "SUPER_ADMIN" ? "Manage Admins" : 
                 role === "INSTITUTION" ? "Settings" : 
                 role === "STAFF" || role === "STUDENT" ? "Profile" :
                 "Dashboard"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-danger focus:bg-danger/10 focus:text-danger">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
