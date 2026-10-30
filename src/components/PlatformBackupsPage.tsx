import { getSession } from "@/lib/auth";
import { authorizeSecurityPermission } from "@/lib/security-permissions";
import { CentralDatabaseBackupSettings } from "@/app/(superadmin)/sa/backups/CentralDatabaseBackupSettings";
export async function PlatformBackupsPage(_props: {
  basePath: string;
  searchParams: Promise<{ institutionId?: string; drive?: string }>;
}) {
  const query = await _props.searchParams;
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "EMPLOYEE"].includes(session.role))
    throw Error("Forbidden");
  if (!(await authorizeSecurityPermission(session, "platform.security")))
    return (
      <p className="text-sm text-stone-600">
        Full database backup and recovery is available to the Super Admin only.
      </p>
    );
  return <CentralDatabaseBackupSettings connectionResult={query.drive} />;
}
