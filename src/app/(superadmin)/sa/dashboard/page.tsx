import { StatCard } from "@/components/ui/stat-card";
import { Building2, Users, FileCheck, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { institutions, employees, students } from "@/db/schema";
import { count, eq, desc, isNull } from "drizzle-orm";

export default async function SuperAdminDashboard() {
  // Fetch actual data
  const [totalInsts] = await db.select({ value: count() }).from(institutions);
  const [pendingInsts] = await db.select({ value: count() }).from(institutions).where(eq(institutions.status, "PENDING"));
  const [activeEmps] = await db.select({ value: count() }).from(employees).where(isNull(employees.deletedAt));
  const [totalStuds] = await db.select({ value: count() }).from(students);

  const recentRegistrations = await db.select()
    .from(institutions)
    .orderBy(desc(institutions.createdAt))
    .limit(5);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Platform Overview</h1>
        <p className="text-stone-500 mt-1">Monitor all institutions and employees.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Institutions" value={totalInsts.value.toString()} icon={Building2} />
        <StatCard title="Pending Verifications" value={pendingInsts.value.toString()} icon={FileCheck} />
        <StatCard title="Active Employees" value={activeEmps.value.toString()} icon={Users} />
        <StatCard title="Total Students" value={totalStuds.value.toString()} icon={CheckCircle} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRegistrations.length === 0 && (
                <p className="text-stone-500 text-sm py-4">No recent registrations found.</p>
              )}
              {recentRegistrations.map(inst => (
                <div key={inst.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-stone-50/50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-bold">
                      {inst.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-brand-900">{inst.name}</p>
                      <p className="text-sm text-stone-500">{inst.city}, {inst.country} • {inst.type}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    inst.status === 'PENDING' ? 'bg-warning/20 text-yellow-700' :
                    inst.status === 'APPROVED' ? 'bg-success/20 text-emerald-700' :
                    'bg-danger/20 text-red-700'
                  }`}>
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left px-4 py-3 text-sm font-medium rounded-md hover:bg-stone-50 transition-colors border border-transparent hover:border-border text-brand-800">
              Review Pending Institutions →
            </button>
            <button className="w-full text-left px-4 py-3 text-sm font-medium rounded-md hover:bg-stone-50 transition-colors border border-transparent hover:border-border text-brand-800">
              Create New Employee →
            </button>
            <button className="w-full text-left px-4 py-3 text-sm font-medium rounded-md hover:bg-stone-50 transition-colors border border-transparent hover:border-border text-brand-800">
              View Audit Logs →
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
