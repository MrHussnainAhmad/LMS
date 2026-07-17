import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DownloadAppUploader } from "@/components/DownloadAppUploader";

export default async function InstitutionAdminDownloadAppPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION_ADMIN") redirect("/institution/dashboard");

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-brand-950">Android app download</h1><p className="mt-1 text-stone-600">Replace the APK available from the public download page.</p></div>
      <DownloadAppUploader />
    </div>
  );
}
