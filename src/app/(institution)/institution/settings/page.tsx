import { db } from "@/db";
import { institutions, platformReviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InstitutionLogoUploader } from "./InstitutionLogoUploader";
import { PlatformReviewForm } from "@/components/PlatformReviewForm";
import { Star } from "lucide-react";

export default async function InstitutionSettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") {
    redirect("/login");
  }

  const institutionId = session.userId;

  const instData = await db.select()
    .from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  if (instData.length === 0) {
    redirect("/login");
  }

  const profile = instData[0];
  const [existingReview] = await db.select().from(platformReviews).where(eq(platformReviews.institutionId, institutionId)).limit(1);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Settings</h1>
          <p className="text-stone-500 mt-1">Manage your institution profile and security preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-600" />
              Institution Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <InstitutionLogoUploader currentLogoKey={profile.logoKey} institutionName={profile.name} />
            <div className="border-t border-border" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Institution Name</label>
                <p className="mt-1 font-semibold text-brand-950">{profile.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Type</label>
                <p className="mt-1 text-stone-700">{profile.type}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Username</label>
                <p className="mt-1 text-stone-700 font-mono text-sm">{profile.username}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Registration No.</label>
                <p className="mt-1 text-stone-700 font-mono text-sm">{profile.registrationNumber}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Contact Details</label>
                <p className="mt-1 text-stone-700">{profile.contactEmail} • {profile.contactPhone}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Location</label>
                <p className="mt-1 text-stone-700">{profile.address}, {profile.city}, {profile.country}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-brand-600" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Current Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">New Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="button"
                className="bg-brand-800 text-white rounded-md px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
                disabled
              >
                Update Password (Coming Soon)
              </button>
            </form>
          </CardContent>
        </Card>

        {existingReview && (
          <Card>
            <CardHeader className="border-b border-border bg-brand-50/50">
              <CardTitle className="text-lg flex items-center gap-2 text-brand-800">
                <Star className="h-5 w-5 fill-brand-600 text-brand-600" />
                Your Platform Review
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-stone-500 text-sm mb-4">You can update the review that is featured on our homepage.</p>
              <PlatformReviewForm defaultRating={existingReview.rating} defaultContent={existingReview.content} isUpdate={true} />
            </CardContent>
          </Card>
        )}

        {/* Data Management */}
        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-stone-500 text-sm mb-4">Download a complete archive of your institution's records (Students, Staff, Classes, Sections) in CSV format.</p>
            <a href="/api/institution/export" download>
              <button className="bg-brand-800 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-brand-900 transition-colors">
                Download All Data (.zip)
              </button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
