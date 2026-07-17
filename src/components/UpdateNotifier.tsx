"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function UpdateNotifier() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const currentVersion = process.env.NEXT_PUBLIC_BUILD_ID;
    
    // In dev mode without a BUILD_ID, we might just skip polling 
    // to avoid unnecessary requests, but for testing we can allow it.
    if (!currentVersion) return;

    let intervalId: NodeJS.Timeout;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version !== 'dev' && data.version !== currentVersion) {
            setShowUpdate(true);
            if (intervalId) clearInterval(intervalId);
          }
        }
      } catch (e) {
        // Ignore network errors
      }
    };

    // Check every 5 minutes
    intervalId = setInterval(checkVersion, 5 * 60 * 1000);

    // Also check when window gains focus
    const handleFocus = () => checkVersion();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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
