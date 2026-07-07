import { EmptyState } from "@/components/ui/empty-state";
import { getVisibleAnnouncements } from "@/lib/announcements";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CalendarClock, CheckCircle2, Megaphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

function roleLabel(role: string) {
  return role.replace("_", " ");
}

export default async function StudentAnnouncementsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) redirect("/login");

  const announcements = await getVisibleAnnouncements(session, 50);

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-brand-950">Announcements</h1>
        <p className="text-stone-500 mt-1 text-sm lg:text-base">Latest notices shared with your class, section, or campus.</p>
      </div>

      {announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="New notices from your institution will appear here."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Link
              key={announcement.id}
              href={`/announcements/${announcement.id}`}
              className={cn(
                "block rounded-lg border bg-surface p-4 shadow-sm transition-colors hover:bg-stone-50",
                announcement.isRead ? "border-border" : "border-brand-200 bg-brand-50/40"
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-brand-950">{announcement.title}</h2>
                    {!announcement.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600">{announcement.content}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-stone-500 sm:justify-end">
                  {announcement.isRead ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Read
                    </>
                  ) : (
                    <>
                      <Megaphone className="h-4 w-4 text-brand-700" />
                      New
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
                <span className="font-medium capitalize text-stone-600">From {roleLabel(announcement.senderRole)}</span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {announcement.createdAtLabel}
                </span>
                <span className="rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-600">{announcement.targetType}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
