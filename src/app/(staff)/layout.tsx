import { getSession } from "@/lib/auth";
import { getShellBrandForSession } from "@/lib/shell-brand";
import { redirect } from "next/navigation";
import { StaffShell } from "./StaffShell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") redirect("/login");
  const brand = await getShellBrandForSession(session);
  return (
    <StaffShell userId={session.userId} institutionId={session.institutionId} initialBrand={brand}>
      {children}
    </StaffShell>
  );
}
