import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Database, Globe2, GraduationCap, LockKeyhole, Shield, Star } from "lucide-react";
import { db } from "@/db";
import { institutions, platformReviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformReviewForm } from "@/components/PlatformReviewForm";
import { CourseStreamingSettings } from "@/components/CourseStreamingSettings";
import { getSession } from "@/lib/auth";
import { DangerZone } from "./DangerZone";
import { GraduatedStudentAccessClient } from "./GraduatedStudentAccessClient";
import { InstitutionLogoUploader } from "./InstitutionLogoUploader";
import { InstitutionSignatureUploader } from "./InstitutionSignatureUploader";

const settingsLinkClass = "block rounded-md border border-border p-4 text-left transition-colors hover:bg-stone-50";

export default async function InstitutionSettingsPage() {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) redirect("/login");
  const institutionId = session.institutionId || session.userId;
  const [profile] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
  if (!profile) redirect("/login");
  const [existingReview] = await db.select().from(platformReviews).where(eq(platformReviews.institutionId, institutionId)).limit(1);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand-950">Settings</h1>
        <p className="mt-1 text-stone-500">Manage your institution profile, services, data, and security preferences.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border bg-stone-50/50">
            <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-brand-600" />Institution Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-8 p-6 pt-7 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-6">
              <InstitutionLogoUploader currentLogoKey={profile.logoKey} institutionName={profile.name} />
              <div className="border-t border-border" />
              <InstitutionSignatureUploader currentSignatureKey={profile.signatureKey} />
            </div>
            <dl className="grid content-start gap-x-6 gap-y-5 sm:grid-cols-2">
              <div><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Institution Name</dt><dd className="mt-2 font-semibold text-brand-950">{profile.name}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Type</dt><dd className="mt-2 text-stone-700">{profile.type}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Username</dt><dd className="mt-2 font-mono text-sm text-stone-700">{profile.username}</dd></div>
              <div><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Registration No.</dt><dd className="mt-2 font-mono text-sm text-stone-700">{profile.registrationNumber}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Contact Details</dt><dd className="mt-2 break-words text-stone-700">{profile.contactEmail} · {profile.contactPhone}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium uppercase tracking-wider text-stone-500">Location</dt><dd className="mt-2 leading-6 text-stone-700">{profile.address}, {profile.city}, {profile.country}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="h-5 w-5 text-brand-600" />Course Streaming</CardTitle></CardHeader>
          <CardContent className="p-6 pt-7"><CourseStreamingSettings /></CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><Globe2 className="h-5 w-5 text-brand-600" />Public Website</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-6 pt-7">
            <p className="text-sm leading-6 text-stone-500">Edit the public information shown on your institution website and open the published site.</p>
            <Link href="/institution/settings/public-website" prefetch={false} className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-brand-950 bg-brand-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-800 hover:bg-brand-800">Manage Public Website<ArrowRight className="h-4 w-4" /></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><Shield className="h-5 w-5 text-brand-600" />Academic & Staff Controls</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-6 pt-7">
            <Link href="/institution/settings/grading" prefetch={false} className={settingsLinkClass}><p className="font-medium text-brand-950">Grading Scale</p><p className="mt-1 text-sm leading-6 text-stone-500">Set passing percentage and grade ranges for promotion results.</p></Link>
            <Link href="/institution/settings/roles" prefetch={false} className={settingsLinkClass}><p className="font-medium text-brand-950">Staff Roles</p><p className="mt-1 text-sm leading-6 text-stone-500">Create job roles such as Teacher, Clerk, and Vice Principal.</p></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="h-5 w-5 text-brand-600" />Graduated Students</CardTitle></CardHeader>
          <CardContent className="p-6 pt-7"><GraduatedStudentAccessClient allowGraduatedStudentAccess={profile.allowGraduatedStudentAccess} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-brand-600" />Data Management</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-6 pt-7">
            <p className="text-sm leading-6 text-stone-500">Download a complete archive of your institution&apos;s students, staff, classes, and sections in CSV format.</p>
            <a href="/api/institution/export" download className="inline-flex h-10 items-center justify-center rounded-sm bg-brand-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-900">Download All Data (.zip)</a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><LockKeyhole className="h-5 w-5 text-brand-600" />Security Settings</CardTitle></CardHeader>
          <CardContent className="p-6 pt-7">
            <form className="space-y-5">
              <div><label className="mb-2 block text-sm font-medium text-stone-700">Current Password</label><input type="password" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-stone-700">New Password</label><input type="password" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
              <div><label className="mb-2 block text-sm font-medium text-stone-700">Confirm New Password</label><input type="password" className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></div>
              <button type="button" className="cursor-not-allowed rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white opacity-50" disabled>Update Password (Coming Soon)</button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-stone-50/50"><CardTitle className="flex items-center gap-2 text-lg"><Shield className="h-5 w-5 text-brand-600" />Reset User Password</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-6 pt-7">
            <div className="space-y-2 text-sm leading-6 text-stone-500"><p><strong className="text-stone-700">For requested resets only.</strong></p><p>This creates a temporary password without changing the user&apos;s personal information.</p></div>
            <Link href="/institution/reset-password-panel" className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-900"><Shield className="h-4 w-4" />Open Password Reset</Link>
          </CardContent>
        </Card>

        {existingReview && (
          <Card>
            <CardHeader className="border-b border-border bg-brand-50/50"><CardTitle className="flex items-center gap-2 text-lg text-brand-800"><Star className="h-5 w-5 fill-brand-600 text-brand-600" />Your Platform Review</CardTitle></CardHeader>
            <CardContent className="p-6 pt-7"><p className="mb-5 text-sm leading-6 text-stone-500">Update the review featured on the Nisaab360 homepage.</p><PlatformReviewForm defaultRating={existingReview.rating} defaultContent={existingReview.content} isUpdate /></CardContent>
          </Card>
        )}

        <div className={existingReview ? "" : "lg:col-span-2"}><DangerZone /></div>
      </div>
    </div>
  );
}
