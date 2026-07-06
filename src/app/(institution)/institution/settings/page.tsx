import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings, Shield, Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

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
      </div>
    </div>
  );
}
