import { Metadata } from "next";
import FeaturedInstitutionsClient from "@/components/FeaturedInstitutionsClient";

export const metadata: Metadata = {
  title: "Featured Institutions | Employee",
};

export default function EmployeeFeaturedInstitutionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold font-display text-stone-900 mb-2">Featured Institutions</h1>
      <p className="text-stone-500 mb-8">Manage the partner institutions and logos displayed on the public homepage marquee.</p>
      <FeaturedInstitutionsClient />
    </div>
  );
}
