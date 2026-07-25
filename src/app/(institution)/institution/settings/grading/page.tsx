"use client";

import { useEffect, useState } from 'react';

type Grade = { letter: string; min: number; max: number };
export default function GradingSettingsPage() {
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [grades, setGrades] = useState<Grade[]>([{ letter: 'A+', min: 90, max: 100 }, { letter: 'A', min: 80, max: 89 }, { letter: 'B', min: 70, max: 79 }]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/institution/settings/grading', { signal: controller.signal })
      .then(r => r.json())
      .then(({ scale }) => { if (scale) { setPassingPercentage(scale.passingPercentage); setGrades(scale.gradesJson); } })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const save = async () => {
    const response = await fetch('/api/institution/settings/grading', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passingPercentage, gradesJson: grades }) });
    setMessage(response.ok ? 'Grading scale saved.' : (await response.json()).error || 'Unable to save grading scale.');
  };
  return <div className="max-w-3xl space-y-6 animate-fade-in"><div><h1 className="text-3xl font-display font-bold text-brand-950">Grading Scale</h1><p className="mt-1 text-stone-500">Set the promotion threshold and grade ranges for your institution.</p></div><div className="rounded-xl border border-border bg-white p-6 space-y-5"><label className="block text-sm font-medium">Passing percentage<input className="mt-1 block w-40 rounded border p-2" type="number" min="0" max="100" value={passingPercentage} onChange={e => setPassingPercentage(Number(e.target.value))} /></label><div className="space-y-2"><p className="text-sm font-medium">Grade ranges</p>{grades.map((grade, index) => <div key={index} className="grid grid-cols-[1fr_100px_100px_auto] gap-2"><input className="rounded border p-2" value={grade.letter} aria-label="Grade letter" onChange={e => setGrades(grades.map((item, i) => i === index ? { ...item, letter: e.target.value } : item))}/><input className="rounded border p-2" type="number" value={grade.min} aria-label="Minimum percentage" onChange={e => setGrades(grades.map((item, i) => i === index ? { ...item, min: Number(e.target.value) } : item))}/><input className="rounded border p-2" type="number" value={grade.max} aria-label="Maximum percentage" onChange={e => setGrades(grades.map((item, i) => i === index ? { ...item, max: Number(e.target.value) } : item))}/><button className="text-sm text-danger" onClick={() => setGrades(grades.filter((_, i) => i !== index))}>Remove</button></div>)}<button className="text-sm text-brand-700" onClick={() => setGrades([...grades, { letter: '', min: 0, max: 100 }])}>+ Add grade</button></div><button className="rounded bg-brand-800 px-4 py-2 text-sm font-medium text-white" onClick={save}>Save grading scale</button>{message && <p className="text-sm text-stone-600">{message}</p>}</div></div>;
}
