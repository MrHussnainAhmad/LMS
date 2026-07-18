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
import { NotificationCenter } from "@/components/NotificationCenter";
import { BrandMark, ShellBrand } from "./BrandMark";

interface TopbarProps {
  onMenuClick: () => void;
  role: string;
  brand: ShellBrand;
}

export function Topbar({ onMenuClick, role, brand }: TopbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", {});
      // replace() instead of href — removes current page from history stack
      // so back button can't return to authenticated page
      window.location.replace("/login");
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
        <NotificationCenter />

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
