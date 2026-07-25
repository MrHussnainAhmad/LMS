import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentShell } from "./StudentShell";
import { getShellBrandForSession } from "@/lib/shell-brand";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") redirect("/login");
  const brand = await getShellBrandForSession(session);
  return (
    <StudentShell
      isGraduated={session.studentAcademicStatus === "GRADUATED"}
      userId={session.userId}
      institutionId={session.institutionId}
      initialBrand={brand}
    >
      {children}
    </StudentShell>
  );
}
