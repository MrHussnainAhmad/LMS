import { Metadata } from "next";
import PagesClient from "./PagesClient";

export const metadata: Metadata = {
  title: "Manage Static Pages | Super Admin",
};

export default function PagesManagementPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-display text-stone-900 mb-6">Manage Static Pages</h1>
      <p className="text-stone-500 mb-8">Edit the content of the public footer pages. Changes are locked for 5 minutes after saving.</p>
      <PagesClient />
    </div>
  );
}
