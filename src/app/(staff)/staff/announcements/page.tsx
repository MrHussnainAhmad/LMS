import { db } from "@/db";
import { announcements, staffAssignments, classes, sections } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { LocalDateTime } from "@/components/LocalDateTime";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Megaphone, Bell } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StaffAnnouncementForm } from "./StaffAnnouncementForm";
import { createStaffAnnouncementAction } from "@/app/actions/staff-actions";

export default async function StaffAnnouncementsPage() {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    redirect("/login");
  }

  const staffId = session.userId;
  const institutionId = session.institutionId || 0;

  const recentAnnouncements = await db.select()
    .from(announcements)
    .where(eq(announcements.institutionId, institutionId))
    .orderBy(desc(announcements.createdAt))
    .limit(30);

  // Get distinct classes and sections assigned to this staff member
  const assignments = await db.selectDistinct({
    classId: classes.id,
    className: classes.name,
    sectionId: sections.id,
    sectionName: sections.name,
  })
    .from(staffAssignments)
    .innerJoin(sections, eq(staffAssignments.sectionId, sections.id))
    .innerJoin(classes, eq(sections.classId, classes.id))
    .where(and(eq(staffAssignments.staffId, staffId), eq(staffAssignments.institutionId, institutionId)));

  const uniqueClassesMap = new Map();
  const uniqueSectionsMap = new Map();

  assignments.forEach(a => {
    uniqueClassesMap.set(a.classId, { id: a.classId, name: a.className });
    uniqueSectionsMap.set(a.sectionId, { id: a.sectionId, classId: a.classId, name: a.sectionName });
  });

  const assignedClasses = Array.from(uniqueClassesMap.values());
  const assignedSections = Array.from(uniqueSectionsMap.values());

  async function createAnnouncement(formData: FormData) {
    "use server";
    await createStaffAnnouncementAction(formData);
    redirect("/staff/announcements");
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-950">Notice Board</h1>
          <p className="text-stone-500 mt-1">Read updates and broadcast messages to your classes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border bg-stone-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-brand-600" />
                Institution & Class Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recentAnnouncements.length === 0 && (
                  <div className="p-12 flex flex-col items-center justify-center text-center text-stone-500">
                    <Bell className="h-10 w-10 text-stone-300 mb-3" />
                    <p className="font-medium text-stone-600">No New Announcements</p>
                    <p className="text-sm mt-1">You are all caught up!</p>
                  </div>
                )}
                {recentAnnouncements.map((ann) => (
                  <div key={ann.id} className="p-6 hover:bg-stone-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-brand-950 text-lg">{ann.title}</h3>
                      <span className="text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded-md whitespace-nowrap">
                        <LocalDateTime value={ann.createdAt.toISOString()} compact />
                      </span>
                    </div>
                    <p className="text-stone-600 whitespace-pre-wrap text-sm leading-relaxed">
                      {ann.content}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800 rounded-md">
                        Target: {ann.targetType}
                      </span>
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 rounded-md">
                        From: {ann.senderRole}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <StaffAnnouncementForm 
            classes={assignedClasses}
            sections={assignedSections}
            action={createAnnouncement}
          />
        </div>
      </div>
    </div>
  );
}
