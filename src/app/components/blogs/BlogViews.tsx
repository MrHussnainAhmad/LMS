"use client";

import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';

export default function BlogViews({ slug, initialViews }: { slug: string; initialViews: number }) {
  const [views, setViews] = useState(initialViews);
  const request = useRef<Promise<number> | null>(null);

  useEffect(() => {
    let active = true;
    // Share the request across Strict Mode's effect replay; renders never add visits.
    request.current ??= (async () => {
      let visitorId: string;
      try {
        visitorId = localStorage.getItem('nisaab360:blog-visitor:v1') || crypto.randomUUID();
        localStorage.setItem('nisaab360:blog-visitor:v1', visitorId);
      } catch {
        // Without persistent browser identity, do not inflate the unique count.
        return initialViews;
      }
      const response = await fetch(`/api/public/blogs/${encodeURIComponent(slug)}/views`, {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId }),
      });
      if (!response.ok) throw new Error('Visit count unavailable');
      const data = await response.json();
      return typeof data.views === 'number' ? data.views : initialViews;
    })();
    request.current.then(count => { if (active) setViews(count); }).catch(() => {
      // Counting must never interrupt reading; retain the server-rendered total.
    });
    return () => { active = false; };
  }, [slug, initialViews]);

  return <span title="Unique visitors per browser; refreshing does not add a view" aria-label={`${views} unique views`} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500">
    <Eye aria-hidden="true" className="h-4 w-4" />
    <span>{views.toLocaleString('en-US')} {views === 1 ? 'view' : 'views'}</span>
  </span>;
}
