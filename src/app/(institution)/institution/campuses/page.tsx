import { db } from "@/db";
import { campuses } from "@/db/schema";
import { eq, desc, isNull } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MapPin, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createCampusAction } from "@/app/actions/institution-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteCampusButton } from "./DeleteCampusButton";

export default async function InstitutionCampusesPage() {
  const session = await getSession();
  if (!session || (session.role !== "INSTITUTION" && session.role !== "INSTITUTION_ADMIN")) {
    redirect("/login");
  }

  const institutionId = session.institutionId || session.userId;

  const allCampuses = await db.select()
    .from(campuses)
    .where(eq(campuses.institutionId, institutionId))
    .orderBy(desc(campuses.createdAt));

  async function createCampus(formData: FormData) {
    "use server";
    await createCampusAction(formData);
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Campuses</h1>
          <p className="text-stone-500 mt-1">Manage physical locations and branch campuses.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-600" />
                Active Campuses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Campus Name</th>
                      <th className="px-6 py-4 font-medium">Address</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allCampuses.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 sm:py-8 text-center text-stone-500">
                          No campuses added yet.
                        </td>
                      </tr>
                    )}
                    {allCampuses.map((campus) => (
                      <tr key={campus.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-brand-950">{campus.name}</td>
                        <td className="px-6 py-4 text-stone-600 truncate max-w-[200px]">{campus.address || "N/A"}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-success/20 text-emerald-700">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DeleteCampusButton campusId={campus.id} campusName={campus.name} />
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
                Add New Campus
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form action={createCampus} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Campus Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. North Campus"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Physical Address</label>
                  <textarea
                    name="address"
                    rows={3}
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="123 Education St."
                  />
                </div>
                <SubmitButton
                  className="w-full bg-brand-800 text-white rounded-md py-2 text-sm font-medium hover:bg-brand-900 transition-colors"
                >
                  Create Campus
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
