"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { Loader2, Plus, Save } from "lucide-react";

export default function DiaryClient() {
  const [diaries, setDiaries] = useState<any[]>([]);
  const [classId, setClassId] = useState<number | "">("");
  const [subjectId, setSubjectId] = useState<number | "">("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Dropdown options
  const [assignedSections, setAssignedSections] = useState<any[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    fetchMetadata();
    fetchDiaries();
  }, []);

  const fetchMetadata = async () => {
    try {
      const res = await fetch("/api/staff/assignments");
      if (res.ok) {
        const data = await res.json();
        
        // Extract unique classes from sections
        const uniqueClassesMap = new Map();
        if (data.sectionOptions) {
          data.sectionOptions.forEach((s: any) => {
            if (!uniqueClassesMap.has(s.classId)) {
              uniqueClassesMap.set(s.classId, { id: s.classId, name: s.className });
            }
          });
        }
        setAssignedSections(Array.from(uniqueClassesMap.values()));
        setAssignedSubjects(data.subjectOptions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDiaries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/diary");
      if (res.ok) {
        const data = await res.json();
        setDiaries(data);
      }
    } catch (error) {
      console.error("Failed to fetch diaries", error);
    } finally {
      setIsLoading(false);
    }
  };

  // When class, subject, or date changes, try to auto-fill the content if it already exists
  useEffect(() => {
    if (classId === "" || subjectId === "") return;
    const existing = diaries.find(
      (d) => d.classId === classId && d.subjectId === subjectId && d.date === date
    );
    if (existing) {
      setContent(existing.content);
    } else {
      setContent("");
    }
  }, [classId, subjectId, date, diaries]);

  const handleSave = async () => {
    if (!content) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/staff/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subjectId, date, content }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast({ title: "Success", description: "Diary entry saved successfully." });
      await fetchDiaries();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create diary entry.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && diaries.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200">
        <h2 className="text-lg font-semibold mb-4">Daily Diary Entry</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-stone-700">Class</label>
            <select
              className="w-full bg-white border border-stone-200 rounded-lg text-sm px-3 py-2 mt-1"
              value={classId}
              onChange={(e) => setClassId(parseInt(e.target.value) || "")}
            >
              <option value="">Select a Class</option>
              {assignedSections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Subject</label>
            <select
              className="w-full bg-white border border-stone-200 rounded-lg text-sm px-3 py-2 mt-1"
              value={subjectId}
              onChange={(e) => setSubjectId(parseInt(e.target.value) || "")}
            >
              <option value="">Select a Subject</option>
              {assignedSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Date</label>
            <input
              type="date"
              className="w-full bg-white border border-stone-200 rounded-lg text-sm px-3 py-2 mt-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-4">
          <textarea
            placeholder="What is the homework or classwork for today?"
            className="w-full bg-white border border-stone-200 rounded-lg text-sm px-3 py-2 min-h-[120px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button onClick={handleSave} disabled={isSaving || !content} className="bg-brand-600 hover:bg-brand-700 w-full sm:w-auto">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Entry
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Previous Entries</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {diaries.map((d) => (
            <div key={d.id} className="bg-white p-5 rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setClassId(d.classId); setSubjectId(d.subjectId); setDate(d.date); }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">Class: {d.classId} | Subject: {d.subjectId}</span>
                <span className="text-xs text-stone-500">{d.date}</span>
              </div>
              <p className="text-sm text-stone-700 line-clamp-3">{d.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
