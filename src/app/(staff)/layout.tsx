import { getSession } from "@/lib/auth";
import { getShellBrandForSession } from "@/lib/shell-brand";
import { redirect } from "next/navigation";
import { StaffShell } from "./StaffShell";
import { isInstitutionCourseStreamingConfigured } from "@/lib/course-streaming";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") redirect("/login");
  const institutionId = session.institutionId;
  const [brand, coursesEnabled] = await Promise.all([
    getShellBrandForSession(session),
    institutionId
      ? isInstitutionCourseStreamingConfigured(institutionId)
      : Promise.resolve(false),
  ]);
  return (
    <StaffShell userId={session.userId} institutionId={institutionId} initialBrand={brand} coursesEnabled={coursesEnabled}>
      {children}
    </StaffShell>
  );
}
