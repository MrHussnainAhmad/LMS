import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Search } from "lucide-react";

export default async function SAAuditLogsPage() {
  const allLogs = await db.select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(100); // Prevent massive payloads

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Audit Logs</h1>
          <p className="text-stone-500 mt-1">Review system-wide activities and security events.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-600" />
              Recent Activity
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search logs..."
                className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                disabled
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Actor Role</th>
                  <th className="px-6 py-4 font-medium">Actor ID</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Target</th>
                  <th className="px-6 py-4 font-medium">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                      No audit logs recorded yet.
                    </td>
                  </tr>
                )}
                {allLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800 rounded-md">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-600 font-mono text-xs">
                      #{log.actorId}
                    </td>
                    <td className="px-6 py-4 font-medium text-brand-950">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      {log.target}
                    </td>
                    <td className="px-6 py-4 text-stone-500 font-mono text-xs">
                      {log.ip || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
