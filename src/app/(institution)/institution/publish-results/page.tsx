import { db } from "@/db";
import { classes, sections, subjects } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PublishResultsForm } from "@/components/institution/PublishResultsForm";

export default async function PublishResultsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION" || !session.institutionId) redirect("/login");

  const [classList, sectionList, subjectList] = await Promise.all([
    db.select().from(classes).where(eq(classes.institutionId, session.institutionId)).orderBy(classes.level),
    db.select().from(sections).where(eq(sections.institutionId, session.institutionId)),
    db.select().from(subjects).where(eq(subjects.institutionId, session.institutionId)),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-brand-950">Publish Results</h1>
        <p className="text-stone-500 mt-1">Upload a CSV to publish batch exam results for a class.</p>
      </div>
      
      <PublishResultsForm 
        classes={classList} 
        sections={sectionList} 
        subjects={subjectList} 
      />
    </div>
  );
}
