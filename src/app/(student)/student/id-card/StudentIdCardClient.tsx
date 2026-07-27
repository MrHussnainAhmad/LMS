"use client";

import { useState } from "react";

type StudentCardData = {
  id: number;
  name: string;
  fatherName: string | null;
  phone: string | null;
  emergencyContact: string | null;
  profilePictureUrl: string | null;
  loginRollNumber: string;
  classRollNumber: string;
  className: string;
  sectionName: string;
};

type InstitutionData = {
  name: string;
  logoKey: string;
  signatureKey: string | null;
};

/* ── Nisaab360 inline SVG logo ───────────────────────────────────────────────── */
function Nisaab360Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Nisaab360">
      <rect width="40" height="40" rx="8" fill="#1e3a5f" />
      <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#f0c040" fontFamily="serif">N</text>
    </svg>
  );
}

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

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#fff" }}>{value}</div>
    </div>
  );
}

function BackRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 7, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{label}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#1e293b" }}>{value}</div>
      </div>
    </div>
  );
}

export function StudentIdCardClient({ student, institution }: { student: StudentCardData; institution: InstitutionData }) {
  const [flipped, setFlipped] = useState(false);

  const cardW = 338;
  const cardH = 213;

  const frontStyle: React.CSSProperties = {
    width: cardW, minHeight: cardH,
    background: "linear-gradient(145deg, #0f2044 0%, #1a3a6e 60%, #0d2a55 100%)",
    borderRadius: 14, position: "relative", overflow: "hidden",
    color: "#fff", fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
  };

  const backStyle: React.CSSProperties = {
    width: cardW, minHeight: cardH,
    background: "#fff",
    borderRadius: 14, position: "relative", overflow: "hidden",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    border: "1.5px solid #e2e8f0",
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden }
          #student-print-card, #student-print-card * { visibility: visible }
          #student-print-card { position: absolute; left: 40px; top: 40px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div id="student-print-card" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {/* FRONT */}
        <div style={frontStyle}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #f0c040 0%, #f59e0b 50%, #f0c040 100%)" }} />
          <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

          <div style={{ display: "flex", padding: "16px 14px 14px", gap: 12, position: "relative" }}>
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

            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", color: "#f0c040", textTransform: "uppercase", marginBottom: 2 }}>
                {institution.name}
              </div>
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

        {/* BACK */}
        <div style={backStyle}>
          <div style={{ height: 4, background: "linear-gradient(90deg, #f0c040 0%, #f59e0b 50%, #f0c040 100%)" }} />
          <div style={{ padding: "12px 14px 10px" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                Contact Information
              </div>
              <BackRow icon="📱" label="Student Phone" value={student.phone || "—"} />
              <BackRow icon="🚨" label="Emergency" value={student.emergencyContact || "—"} />
            </div>
            <div style={{ height: 1, background: "#e2e8f0", marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Nisaab360Logo size={26} />
                <div>
                  <div style={{ fontSize: 8.5, fontWeight: 800, color: "#1e3a5f" }}>Nisaab360</div>
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

      {/* Action buttons */}
      <div className="no-print mt-6 flex justify-center gap-3">
        <button
          onClick={() => setFlipped(!flipped)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {flipped ? "Show Front" : "Show Back"}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-800 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 flex items-center gap-2"
        >
          🖨️ Print / Download
        </button>
      </div>
    </div>
  );
}
