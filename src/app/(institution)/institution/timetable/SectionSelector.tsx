"use client";

import { useRouter } from "next/navigation";

export function SectionSelector({ 
  sections, 
  defaultSectionId 
}: { 
  sections: { id: number, name: string, className: string }[], 
  defaultSectionId: string | number | null 
}) {
  const router = useRouter();

  return (
    <select 
      className="h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[200px]"
      defaultValue={defaultSectionId || ""}
      onChange={(e) => {
        router.push(`/institution/timetable?sectionId=${e.target.value}`);
      }}
    >
      {sections.map(s => (
        <option key={s.id} value={s.id}>
          {s.className} - {s.name}
        </option>
      ))}
    </select>
  );
}
