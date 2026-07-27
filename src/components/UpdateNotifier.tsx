"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

function isAuthenticatedPortalPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname.startsWith("/student") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/institution") ||
    pathname.startsWith("/employee") ||
    pathname.startsWith("/sa") ||
    pathname.startsWith("/batch-results") ||
    pathname.startsWith("/force-password-change")
  );
}

/**
 * Version check only on public surfaces, and only on window focus —
 * no interval polling (avoids /api/version CPU on idle authenticated users).
 */
export default function UpdateNotifier() {
  const pathname = usePathname();
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (isAuthenticatedPortalPath(pathname)) return;

    const currentVersion = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentVersion) return;

    let ignore = false;

    const checkVersion = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok || ignore) return;
        const data = await res.json();
        if (data.version && data.version !== "dev" && data.version !== currentVersion) {
          setShowUpdate(true);
        }
      } catch {
        // Ignore network errors
      }
    };

    const onFocus = () => void checkVersion();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void checkVersion();

    return () => {
      ignore = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-white dark:bg-zinc-900 border border-border shadow-lg rounded-lg p-4 flex flex-col gap-3 max-w-sm">
        <p className="text-sm font-medium text-foreground">
          Website has been updated. Please refresh page or click update.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Update Now
        </button>
      </div>
    </div>
  );
}
