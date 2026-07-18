"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export default function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const match = document.cookie.match(/(^| )session_exp=([^;]+)/);
        if (!match) return;

        const exp = parseInt(match[2], 10);
        const now = Date.now();
        const timeRemaining = exp - now;

        // If less than 5 minutes remaining
        if (timeRemaining > 0 && timeRemaining < 5 * 60 * 1000) {
          if (navigator.onLine) {
            // Silently refresh in the background
            try {
              await api.post("/api/auth/refresh", {});
            } catch (err) {
              console.warn("Background session refresh failed", err);
            }
          }
        } else if (timeRemaining <= 0) {
          // Session is expired
          if (!navigator.onLine) {
            // If offline and expired, force logout as per requirement
            try {
              await api.post("/api/auth/logout", {});
            } catch (e) {
              // ignore network error on logout
            }
            window.location.replace("/login");
          }
        }
      } catch (err) {
        console.error("SessionWatcher error:", err);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
