import { db } from "@/db";
import { institutions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Building2, FileSearch } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateInstitutionStatusAction, deleteInstitutionAction } from "@/app/actions/employee-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

export default async function EmployeeVerificationQueuePage() {
  const session = await getSession();
  if (!session || session.role !== "EMPLOYEE") {
    redirect("/login");
  }

  const allInstitutions = await db.select()
    .from(institutions)
    .orderBy(desc(institutions.createdAt));

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Institutions Queue</h1>
          <p className="text-stone-500 mt-1">Review, verify, and manage institution applications.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-border bg-stone-50/50">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-600" />
            All Applications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Institution Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Submitted At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allInstitutions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-stone-500">
                        <FileSearch className="h-10 w-10 text-stone-300 mb-3" />
                        <p className="text-base font-medium text-stone-600">No Applications</p>
                        <p className="text-sm mt-1">There are currently no institutions in the system.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {allInstitutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-brand-950">{inst.name}</td>
                    <td className="px-6 py-4 text-stone-600">{inst.type}</td>
                    <td className="px-6 py-4 text-stone-600">{inst.city}, {inst.country}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        inst.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                        inst.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-stone-500">
                      {new Date(inst.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {inst.status === "PENDING" && (
                          <>
                            <form action={async () => {
                              "use server";
                              await updateInstitutionStatusAction(inst.id, "APPROVED");
                            }}>
                              <SubmitButton className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1 text-xs font-medium">Accept</SubmitButton>
                            </form>
                            <form action={async () => {
                              "use server";
                              await updateInstitutionStatusAction(inst.id, "REJECTED");
                            }}>
                              <SubmitButton className="bg-rose-600 hover:bg-rose-700 text-white rounded-md px-3 py-1 text-xs font-medium">Reject</SubmitButton>
                            </form>
                          </>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-md px-3 py-1 text-xs font-medium transition-colors">
                              Delete
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="text-rose-600">Delete Institution</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                              <p className="text-sm text-stone-600">
                                Are you absolutely sure you want to delete <strong>{inst.name}</strong>? This action cannot be undone and will permanently remove this institution and all its associated data from the platform.
                              </p>
                            </div>
                            <div className="flex justify-end gap-3">
                              <DialogClose asChild>
                                <button className="bg-white border border-border text-stone-700 hover:bg-stone-50 rounded-md px-4 py-2 text-sm font-medium transition-colors">
                                  Cancel
                                </button>
                              </DialogClose>
                              <form action={async () => {
                                "use server";
                                await deleteInstitutionAction(inst.id);
                              }}>
                                <SubmitButton className="bg-rose-600 hover:bg-rose-700 text-white rounded-md px-4 py-2 text-sm font-medium">
                                  Yes, Delete
                                </SubmitButton>
                              </form>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
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
