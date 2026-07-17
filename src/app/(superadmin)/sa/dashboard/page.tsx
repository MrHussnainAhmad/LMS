import { DashboardAnnouncements } from "@/components/announcements/DashboardAnnouncements";
import { MobileAppVersionUpdater } from "@/components/sa/MobileAppVersionUpdater";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { db } from "@/db";
import { employees, institutions, students, systemSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { count, desc, eq, isNull } from "drizzle-orm";
import { Building2, CheckCircle, FileCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SuperAdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/login/super-admin");

  const [totalInstRows, pendingInstRows, activeEmpRows, totalStudRows, recentAnnouncements, recentRegistrations, settingsData] = await Promise.all([
    db.select({ value: count() }).from(institutions),
    db.select({ value: count() }).from(institutions).where(eq(institutions.status, "PENDING")),
    db.select({ value: count() }).from(employees).where(isNull(employees.deletedAt)),
    db.select({ value: count() }).from(students),
    getVisibleAnnouncements(session, 4),
    db.select().from(institutions).orderBy(desc(institutions.createdAt)).limit(5),
    db.select().from(systemSettings).limit(1),
  ]);
  const totalInsts = totalInstRows[0];
  const pendingInsts = pendingInstRows[0];
  const activeEmps = activeEmpRows[0];
  const totalStuds = totalStudRows[0];
  const currentAppVersion = settingsData[0]?.mobileAppVersion || "1.0.0";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Platform Overview</h1>
        <p className="text-stone-500 mt-1">Monitor all institutions and employees.</p>
      </div>

      <MobileAppVersionUpdater currentVersion={currentAppVersion} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Institutions" value={totalInsts.value.toString()} icon={Building2} />
        <StatCard title="Pending Verifications" value={pendingInsts.value.toString()} icon={FileCheck} />
        <StatCard title="Active Employees" value={activeEmps.value.toString()} icon={Users} />
        <StatCard title="Total Students" value={totalStuds.value.toString()} icon={CheckCircle} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRegistrations.length === 0 && (
                <p className="text-stone-500 text-sm py-4">No recent registrations found.</p>
              )}
              {recentRegistrations.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-stone-50/50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-bold">
                      {inst.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-brand-900">{inst.name}</p>
                      <p className="text-sm text-stone-500">{inst.city}, {inst.country} - {inst.type}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    inst.status === "PENDING" ? "bg-warning/20 text-yellow-700" :
                    inst.status === "APPROVED" ? "bg-success/20 text-emerald-700" :
                    "bg-danger/20 text-red-700"
                  }`}>
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <DashboardAnnouncements announcements={recentAnnouncements} />
      </div>
    </div>
  );
}
