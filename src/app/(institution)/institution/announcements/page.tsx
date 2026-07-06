import { db } from "@/db";
import { announcements, campuses, classes, sections } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAnnouncementAction } from "@/app/actions/institution-actions";
import { AnnouncementFormClient } from "./AnnouncementFormClient";

export default async function InstitutionAnnouncementsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") {
    redirect("/login");
  }

  const institutionId = session.userId;

  const allAnnouncements = await db.select()
    .from(announcements)
    .where(eq(announcements.institutionId, institutionId))
    .orderBy(desc(announcements.createdAt));

  const allCampuses = await db.select().from(campuses).where(eq(campuses.institutionId, institutionId));
  const allClasses = await db.select().from(classes).where(eq(classes.institutionId, institutionId));
  const allSections = await db.select().from(sections).where(eq(sections.institutionId, institutionId));

  async function createAnnouncement(formData: FormData) {
    "use server";
    await createAnnouncementAction(formData);
    redirect("/institution/announcements");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Announcements</h1>
          <p className="text-stone-500 mt-1">Broadcast messages to staff and students.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-brand-600" />
                Recent Broadcasts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-stone-500 uppercase bg-stone-50 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Title</th>
                      <th className="px-6 py-4 font-medium">Target Audience</th>
                      <th className="px-6 py-4 font-medium">Date Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allAnnouncements.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-stone-500">
                          No announcements sent yet.
                        </td>
                      </tr>
                    )}
                    {allAnnouncements.map((ann) => (
                      <tr key={ann.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-brand-950">{ann.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800 rounded-md">
                            {ann.targetType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-stone-500">
                          {new Date(ann.createdAt).toLocaleString()}
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
          <AnnouncementFormClient 
            campuses={allCampuses}
            classes={allClasses}
            sections={allSections}
            action={createAnnouncement}
          />
        </div>
      </div>
    </div>
  );
}
