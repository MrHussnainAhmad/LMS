import { getSession } from "@/lib/auth";
import { authorizeSecurityPermission } from "@/lib/security-permissions";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { asc } from "drizzle-orm";
import { InstitutionRestoreRequests } from "@/components/InstitutionRestoreRequests";
export async function PlatformInstitutionRestoresPage() {
  const session = await getSession();
  if (
    !session ||
    !(await authorizeSecurityPermission(session, "platform.restore"))
  )
    throw Error("Forbidden");
  const schools = await db
    .select({
      id: institutions.id,
      name: institutions.name,
      username: institutions.username,
    })
    .from(institutions)
    .orderBy(asc(institutions.name))
    .limit(2000);
  return <InstitutionRestoreRequests administrator institutions={schools} />;
}
