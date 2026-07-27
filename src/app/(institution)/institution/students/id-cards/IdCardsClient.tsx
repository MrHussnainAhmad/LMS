"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";

type PickerStudent = { id: number; name: string; classRollNumber: string; className: string; sectionName: string };
type CardStudent = PickerStudent & {
  fatherName: string | null;
  phone: string | null;
  emergencyContact: string | null;
  profilePictureUrl: string | null;
  loginRollNumber: string;
};
type CardData = {
  institution: { name: string; logoKey: string; signatureKey: string | null; address: string; contactPhone: string };
  students: CardStudent[];
};

const MAX_SELECTION = 200;
const SEARCH_DEBOUNCE_MS = 300;

/* ── Nisaab360 inline SVG wordmark ─────────────────────────────────────────── */
function Nisaab360Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Nisaab360">
      <rect width="40" height="40" rx="8" fill="#1e3a5f" />
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#f0c040" fontFamily="serif">N</text>
    </svg>
  );
}

/* ── Verified badge ─────────────────────────────────────────────────────────── */
function VerifiedBadge() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
      borderRadius: 20, padding: "3px 10px", color: "#fff",
      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      VERIFIED
    </div>
  );
}

/* ── Single ID card component ───────────────────────────────────────────────── */
function IdCard({ student, institution }: { student: CardStudent; institution: CardData["institution"] }) {
  const cardW = 338; // 85.6 mm ≈ 323px @96dpi; we use 338 for a bit of breathing room
  const cardH = 213; // 53.98 mm

  const frontStyle: React.CSSProperties = {
    width: cardW, minHeight: cardH,
    background: "linear-gradient(145deg, #0f2044 0%, #1a3a6e 60%, #0d2a55 100%)",
    borderRadius: 14, position: "relative", overflow: "hidden",
    color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    pageBreakInside: "avoid",
  };

  const backStyle: React.CSSProperties = {
    width: cardW, minHeight: cardH,
    background: "#fff",
    borderRadius: 14, position: "relative", overflow: "hidden",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    border: "1.5px solid #e2e8f0",
    pageBreakInside: "avoid",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, breakInside: "avoid" as React.CSSProperties["breakInside"] }}>
      {/* ── FRONT ── */}
      <div style={frontStyle} className="id-card">
        {/* Gold accent bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #f0c040 0%, #f59e0b 50%, #f0c040 100%)" }} />
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        <div style={{ display: "flex", padding: "16px 14px 14px", gap: 12, position: "relative" }}>
          {/* Photo */}
          <div style={{
            width: 72, height: 88, borderRadius: 8, overflow: "hidden", flexShrink: 0,
            background: "rgba(255,255,255,0.12)", border: "2px solid rgba(240,192,64,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {student.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.profilePictureUrl} alt={student.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {/* Institution name */}
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", color: "#f0c040", textTransform: "uppercase", marginBottom: 2 }}>
              {institution.name}
            </div>
            {/* Card type */}
            <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Student Identity Card
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 2 }}>
              {student.name}
            </div>
            {student.fatherName && (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                S/O · D/O: {student.fatherName}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
              <InfoPill label="Class" value={student.className} />
              <InfoPill label="Section" value={student.sectionName} />
              <InfoPill label="Roll No." value={student.classRollNumber} />
              <InfoPill label="ID" value={student.loginRollNumber} />
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(0,0,0,0.25)", padding: "6px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {institution.logoKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={institution.logoKey} alt="logo" style={{ height: 18, width: 18, objectFit: "contain", borderRadius: 3 }} />
            )}
          </div>
          {institution.signatureKey && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={institution.signatureKey} alt="signature" style={{ height: 20, maxWidth: 70, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }} />
              <div style={{ fontSize: 6, color: "rgba(255,255,255,0.5)", marginTop: 1, letterSpacing: "0.08em" }}>PRINCIPAL</div>
            </div>
          )}
        </div>
      </div>

      {/* ── BACK ── */}
      <div style={backStyle} className="id-card">
        {/* Gold top bar */}
        <div style={{ height: 4, background: "linear-gradient(90deg, #f0c040 0%, #f59e0b 50%, #f0c040 100%)" }} />

        <div style={{ padding: "12px 14px 10px" }}>
          {/* Contact info */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
              Contact Information
            </div>
            <BackRow icon="📱" label="Student Phone" value={student.phone || "—"} />
            <BackRow icon="🚨" label="Emergency" value={student.emergencyContact || "—"} />
          </div>

          <div style={{ height: 1, background: "#e2e8f0", marginBottom: 10 }} />

          {/* Branding row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Nisaab360Logo size={26} />
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: "#1e3a5f", letterSpacing: "0.02em" }}>Nisaab360</div>
                <div style={{ fontSize: 6.5, color: "#94a3b8" }}>Powered by</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {institution.logoKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={institution.logoKey} alt={institution.name} style={{ height: 26, maxWidth: 60, objectFit: "contain" }} />
              )}
              <div style={{ fontSize: 7.5, fontWeight: 700, color: "#1e3a5f", maxWidth: 80, textAlign: "right", lineHeight: 1.2 }}>
                {institution.name}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <VerifiedBadge />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#fff" }}>{value}</div>
    </div>
  );
}

function BackRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 7, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#1e293b" }}>{value}</div>
      </div>
    </div>
  );
}

/* ── Main client component ──────────────────────────────────────────────────── */
export function IdCardsClient({ initialStudentId }: { initialStudentId?: number }) {
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<PickerStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<number[]>(initialStudentId ? [initialStudentId] : []);
  const [selectedDetails, setSelectedDetails] = useState<Map<number, PickerStudent>>(new Map());
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-load card when initialStudentId provided (from student detail page deep-link)
  useEffect(() => {
    if (!initialStudentId) return;
    setLoading(true);
    api.get<CardData>(`/api/institution/students/id-cards?studentIds=${initialStudentId}`)
      .then((data) => {
        setCardData(data);
        const s = data.students[0];
        if (s) {
          setSelectedDetails(new Map([[s.id, { id: s.id, name: s.name, classRollNumber: s.classRollNumber, className: s.className, sectionName: s.sectionName }]]));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load id card"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!query.trim()) return;

    let ignore = false;

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
        .catch(() => { if (!ignore) setResults([]); })
        .finally(() => { if (!ignore) setSearching(false); });
    }, SEARCH_DEBOUNCE_MS);

    return () => { ignore = true; clearTimeout(timer); };
  }, [query]);

  const toggle = (student: PickerStudent) => {
    setSelected((items) =>
      items.includes(student.id) ? items.filter((item) => item !== student.id) : [...items, student.id]
    );
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load id cards");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const selectedList = useMemo(
    () => selected.map((id) => selectedDetails.get(id)).filter((s): s is PickerStudent => Boolean(s)),
    [selected, selectedDetails]
  );

  const selectedStudents = cardData?.students.filter((student) => selected.includes(student.id)) || [];

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden }
          #print-cards, #print-cards * { visibility: visible }
          #print-cards { position: absolute; left: 0; top: 0; width: 100%; padding: 12px; }
          .id-card { break-inside: avoid; }
        }
      `}</style>

      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <input
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setResults([]);
            setHasSearched(false);
            setSearching(Boolean(nextQuery.trim()));
          }}
          placeholder="Search by name, roll no. or class…"
          className="w-full max-w-sm rounded-md border border-border px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            className="rounded bg-brand-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            disabled={!selected.length || selected.length > MAX_SELECTION || loading}
            onClick={generate}
          >
            {loading ? "Loading…" : `Preview cards (${selected.length})`}
          </button>
          {cardData && selectedStudents.length > 0 && (
            <button
              className="rounded border border-brand-800 px-4 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
              onClick={handlePrint}
            >
              🖨️ Print
            </button>
          )}
        </div>
      </div>

      {selected.length > MAX_SELECTION && (
        <p className="text-sm text-red-600">Select at most {MAX_SELECTION} students at a time.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Selected chips */}
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

      {/* Search results table */}
      <div className="overflow-x-auto rounded-sm border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              <th className="p-3" />
              <th className="p-3">Student</th>
              <th className="p-3">Class</th>
              <th className="p-3">Roll no.</th>
            </tr>
          </thead>
          <tbody>
            {searching && results.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-t">
                  <td className="p-3" colSpan={4}><div className="h-4 w-full animate-pulse rounded bg-stone-100" /></td>
                </tr>
              ))
            }
            {!searching && !query.trim() && (
              <tr><td className="p-4 text-center text-stone-500" colSpan={4}>Start typing a name, roll no. or class to find students.</td></tr>
            )}
            {!searching && query.trim() && hasSearched && results.length === 0 && (
              <tr><td className="p-4 text-center text-stone-500" colSpan={4}>No students match your search.</td></tr>
            )}
            {results.map((student) => (
              <tr key={student.id} className="border-t hover:bg-stone-50 cursor-pointer" onClick={() => toggle(student)}>
                <td className="p-3"><input type="checkbox" checked={selected.includes(student.id)} onChange={() => toggle(student)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="p-3 font-medium">{student.name}</td>
                <td className="p-3">{student.className} — {student.sectionName}</td>
                <td className="p-3">{student.classRollNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview cards (screen) */}
      {cardData && selectedStudents.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-stone-600 uppercase tracking-wider mb-4">Card Preview</h2>
          <div className="flex flex-wrap gap-6 justify-center">
            {selectedStudents.map((student) => (
              <IdCard key={student.id} student={student} institution={cardData.institution} />
            ))}
          </div>
        </div>
      )}

      {/* Print area (hidden on screen) */}
      <div id="print-cards" style={{ display: "none" }}>
        {selectedStudents.map((student) => (
          <div key={student.id} style={{ display: "inline-block", margin: 8, verticalAlign: "top" }}>
            {cardData && <IdCard student={student} institution={cardData.institution} />}
          </div>
        ))}
      </div>
    </div>
  );
}
