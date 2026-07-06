"use client";

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

interface TopbarProps {
  onMenuClick: () => void;
  role: string;
}

export function Topbar({ onMenuClick, role }: TopbarProps) {
  const router = useRouter();

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
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-stone-500 relative" onClick={() => alert("No new notifications.")}>
          <Bell className="h-5 w-5" />
          {/* Mock notification badge */}
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-danger border-2 border-surface" />
        </Button>

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
              else path = `/${role.toLowerCase().replace('_', '')}/dashboard`;
              router.push(path);
            }}>
              <User className="mr-2 h-4 w-4" />
              <span>
                {role === "SUPER_ADMIN" ? "Manage Admins" : 
                 role === "INSTITUTION" ? "Settings" : 
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
