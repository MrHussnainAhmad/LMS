import { db } from "@/db";
import { staff, campuses, staffProfileChangeRequests } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserSquare2, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createStaffAction } from "@/app/actions/institution-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteStaffButton } from "./DeleteStaffButton";
import { StaffRequestsClient } from "./StaffRequestsClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function InstitutionStaffPage() {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) {
    redirect("/login");
  }

  const institutionId = session.institutionId || session.userId;

  const [allStaff, allCampuses, requests] = await Promise.all([
    db.select({
      staff: staff,
      campus: campuses.name
    })
      .from(staff)
      .leftJoin(campuses, eq(staff.campusId, campuses.id))
      .where(eq(staff.institutionId, institutionId))
      .orderBy(desc(staff.createdAt)),
    db.select().from(campuses).where(eq(campuses.institutionId, institutionId)),
    db.select({
      id: staffProfileChangeRequests.id,
      requestedFields: staffProfileChangeRequests.requestedFields,
      reason: staffProfileChangeRequests.reason,
      status: staffProfileChangeRequests.status,
      adminNote: staffProfileChangeRequests.adminNote,
      createdAt: staffProfileChangeRequests.createdAt,
      staffId: staff.id,
      staffName: staff.name,
      email: staff.email,
      phone: staff.phone,
      campusName: campuses.name,
      isActive: staff.isActive,
    })
      .from(staffProfileChangeRequests)
      .innerJoin(staff, eq(staffProfileChangeRequests.staffId, staff.id))
      .leftJoin(campuses, eq(staff.campusId, campuses.id))
      .where(eq(staffProfileChangeRequests.institutionId, institutionId))
      .orderBy(desc(staffProfileChangeRequests.createdAt)),
  ]);

  async function createStaff(formData: FormData) {
    "use server";
    await createStaffAction(formData);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Staff Management</h1>
          <p className="text-stone-500 mt-1">Manage teachers, administrators, and support staff.</p>
        </div>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          <TabsTrigger value="requests">Staff Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserSquare2 className="h-5 w-5 text-brand-600" />
                Staff Directory
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Email Address</th>
                      <th className="px-6 py-4 font-medium">Campus</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allStaff.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 sm:py-8 text-center text-stone-500">
                          No staff registered yet.
                        </td>
                      </tr>
                    )}
                    {allStaff.map((row) => (
                      <tr key={row.staff.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs">
                              {row.staff.name.substring(0, 2).toUpperCase()}
                            </div>
                            <p className="font-semibold text-brand-950">{row.staff.name}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-stone-600">{row.staff.email}</td>
                        <td className="px-6 py-4 text-stone-500">{row.campus || "Main"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            row.staff.isActive ? 'bg-success/20 text-emerald-700' : 'bg-danger/20 text-red-700'
                          }`}>
                            {row.staff.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DeleteStaffButton staffId={row.staff.id} staffName={row.staff.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-600" />
                Add New Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form action={createStaff} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Assign Campus</label>
                  <select
                    name="campusId"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Main (No specific campus)</option>
                    {allCampuses.map(campus => (
                      <option key={campus.id} value={campus.id}>{campus.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Initial Password</label>
                  <input
                    type="password"
                    name="password"
                    required
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="text-xs text-stone-500 mt-1">An email will be auto-generated for them.</p>
                </div>
                <SubmitButton
                  className="w-full bg-brand-800 text-white rounded-md py-2 text-sm font-medium hover:bg-brand-900 transition-colors"
                >
                  Create Staff Account
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="requests">
          <StaffRequestsClient
            requests={requests.map((request) => ({
              ...request,
              campusName: request.campusName || "Main",
              requestedFields: request.requestedFields as Record<string, string | number>,
              createdAt: request.createdAt.toISOString(),
            }))}
            campuses={allCampuses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
