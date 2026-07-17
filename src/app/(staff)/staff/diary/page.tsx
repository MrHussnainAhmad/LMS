import { Metadata } from "next";
import DiaryClient from "../../../components/diary/DiaryClient";

export const metadata: Metadata = {
  title: "Class Diary | Staff",
};

export default function StaffDiaryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-display text-stone-900 mb-6">Class Diary</h1>
      <DiaryClient />
    </div>
  );
}
