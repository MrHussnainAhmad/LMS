"use client";

import { useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';

export default function BlogViews({ slug, initialViews }: { slug: string; initialViews: number }) {
  const [views, setViews] = useState(initialViews);
  const request = useRef<Promise<number> | null>(null);

  useEffect(() => {
    let active = true;
    // Share the request across Strict Mode's effect replay; renders never add visits.
    request.current ??= fetch(`/api/public/blogs/${encodeURIComponent(slug)}/views`, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('Visit count unavailable');
      const data = await response.json();
      return typeof data.views === 'number' ? data.views : initialViews;
    });
    request.current.then(count => { if (active) setViews(count); }).catch(() => {
      // Counting must never interrupt reading; retain the server-rendered total.
    });
    return () => { active = false; };
  }, [slug, initialViews]);

  return <span title="Total page visits (including repeat visits)" aria-label={`${views} page visits`} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500">
    <Eye aria-hidden="true" className="h-4 w-4" />
    <span>{views.toLocaleString('en-US')} {views === 1 ? 'visit' : 'visits'}</span>
  </span>;
}
