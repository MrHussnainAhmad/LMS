"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

type PickerStudent = { id: number; name: string; classRollNumber: string; className: string; sectionName: string };
type CardStudent = PickerStudent & { fatherName: string | null; profilePictureUrl: string | null; loginRollNumber: string };
type CardData = { institution: { name: string; logoKey: string; address: string; contactPhone: string }; students: CardStudent[] };

const MAX_SELECTION = 200;
const SEARCH_DEBOUNCE_MS = 300;

export function IdCardsClient() {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<PickerStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<Map<number, PickerStudent>>(new Map());
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No fetch on mount: the picker only loads students once the user types a
  // search query, per on-demand fetching rules (debounced input is fine).
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    let ignore = false;
    setSearching(true);

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      fetch(`/api/institution/students/picker?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { students: PickerStudent[] } | null) => {
          if (ignore) return;
          const rows = data?.students ?? [];
          setResults(rows);
          setHasSearched(true);
          setSelectedDetails((prev) => {
            const next = new Map(prev);
            for (const row of rows) next.set(row.id, row);
            return next;
          });
        })
        .catch(() => {
          if (!ignore) setResults([]);
        })
        .finally(() => {
          if (!ignore) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [query]);

  const toggle = (student: PickerStudent) => {
    setSelected((items) => items.includes(student.id) ? items.filter((item) => item !== student.id) : [...items, student.id]);
    setSelectedDetails((prev) => {
      if (prev.has(student.id)) return prev;
      const next = new Map(prev);
      next.set(student.id, student);
      return next;
    });
  };

  const generate = async () => {
    if (!selected.length) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<CardData>(`/api/institution/students/id-cards?studentIds=${selected.join(",")}`);
      setCardData(data);
      requestAnimationFrame(() => window.print());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load id cards");
    } finally {
      setLoading(false);
    }
  };

  const selectedList = useMemo(
    () => selected.map((id) => selectedDetails.get(id)).filter((s): s is PickerStudent => Boolean(s)),
    [selected, selectedDetails]
  );
  const selectedStudents = cardData?.students.filter((student) => selected.includes(student.id)) || [];

  return (
    <div className="space-y-6">
      <style>{`@media print { body * { visibility: hidden } #print-cards, #print-cards * { visibility: visible } #print-cards { position: absolute; left: 0; top: 0; width: 100% } .id-card { break-inside: avoid } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, roll no. or class..."
          className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm"
        />
        <button
          className="rounded bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          disabled={!selected.length || selected.length > MAX_SELECTION || loading}
          onClick={generate}
        >
          {loading ? "Loading..." : `Generate cards (${selected.length})`}
        </button>
      </div>

      {selected.length > MAX_SELECTION && (
        <p className="text-sm text-red-600">Select at most {MAX_SELECTION} students at a time.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedList.map((student) => (
            <span key={student.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-800">
              {student.name}
              <button type="button" onClick={() => toggle(student)} className="text-brand-500 hover:text-brand-800" aria-label={`Remove ${student.name}`}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="p-3" />
              <th className="p-3">Student</th>
              <th className="p-3">Class</th>
              <th className="p-3">Roll no.</th>
            </tr>
          </thead>
          <tbody>
            {searching && results.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t">
                  <td className="p-3" colSpan={4}>
                    <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
                  </td>
                </tr>
              ))
            )}
            {!searching && !query.trim() && (
              <tr>
                <td className="p-4 text-center text-stone-500" colSpan={4}>
                  Start typing a name, roll no. or class to find students.
                </td>
              </tr>
            )}
            {!searching && query.trim() && hasSearched && results.length === 0 && (
              <tr>
                <td className="p-4 text-center text-stone-500" colSpan={4}>
                  No students match your search.
                </td>
              </tr>
            )}
            {results.map((student) => (
              <tr key={student.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.includes(student.id)} onChange={() => toggle(student)} /></td>
                <td className="p-3 font-medium">{student.name}</td>
                <td className="p-3">{student.className} — {student.sectionName}</td>
                <td className="p-3">{student.classRollNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="print-cards" className="hidden print:grid print:grid-cols-2 print:gap-2">
        {selectedStudents.map((student) => (
          <article key={student.id} className="id-card border-2 border-stone-800 p-3 text-xs min-h-40">
            <h2 className="text-base font-bold">{cardData?.institution.name}</h2>
            <p className="mb-2 text-stone-600">Student ID Card</p>
            <p className="font-semibold">{student.name}</p>
            <p>Father: {student.fatherName || "—"}</p>
            <p>Class: {student.className} — {student.sectionName}</p>
            <p>Roll: {student.classRollNumber}</p>
            <p>Login ID: {student.loginRollNumber}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
