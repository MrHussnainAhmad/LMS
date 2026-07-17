"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export function LandingHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 sm:px-6 sm:py-4 shadow-sm md:px-12">
      <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer z-50">
        <div className="h-8 w-8 sm:h-10 sm:w-10 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-100 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src="/Logo.png" alt="Nisaab360 logo" width={40} height={40} quality={80} className="h-full w-full object-contain" />
        </div>
        <span className="font-display font-extrabold text-xl sm:text-2xl bg-gradient-to-r from-stone-900 to-stone-700 bg-clip-text text-transparent tracking-tight">Nisaab360</span>
      </div>
      
      <nav className="hidden lg:flex items-center gap-8">
        <Link href="#testimonials" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Customers</Link>
        <Link href="#pricing" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Pricing</Link>
        <Link href="/download-app" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Download</Link>
        <Link href="/employee-login" className="text-sm font-semibold text-stone-600 hover:text-stone-900 transition-colors">Employee Login</Link>
      </nav>

      <div className="flex items-center gap-2 sm:gap-4 z-50">
        <Button asChild className="landing-hover rounded-full font-semibold shadow-lg shadow-brand-500/20 active:scale-100 text-xs sm:text-sm h-9 sm:h-10 px-4 sm:px-6">
          <Link href="/register">
            <span className="hidden sm:inline">Request as Institution</span>
            <span className="sm:hidden">Register</span>
          </Link>
        </Button>
        <button 
          className="lg:hidden p-2 -mr-2 text-stone-600 hover:bg-stone-50 rounded-md transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-stone-200 shadow-lg py-4 px-6 flex flex-col gap-4 lg:hidden animate-in slide-in-from-top-2">
          <Link href="#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-semibold text-stone-600 hover:text-stone-900 py-2 border-b border-stone-100">Customers</Link>
          <Link href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-semibold text-stone-600 hover:text-stone-900 py-2 border-b border-stone-100">Pricing</Link>
          <Link href="/download-app" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-semibold text-stone-600 hover:text-stone-900 py-2 border-b border-stone-100">Download</Link>
          <Link href="/employee-login" onClick={() => setIsMobileMenuOpen(false)} className="text-base font-semibold text-stone-600 hover:text-stone-900 py-2">Employee Login</Link>
        </div>
      )}
    </header>
  );
}
