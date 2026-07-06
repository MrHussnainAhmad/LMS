import { db } from "@/db";
import { campuses, staff, staffProfileChangeRequests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { StaffRequestsClient } from "./StaffRequestsClient";

export default async function InstitutionStaffRequestsPage() {
  const session = await getSession();
  if (!session || session.role !== "INSTITUTION") redirect("/login");

  const institutionId = session.userId;

  const [requests, allCampuses] = await Promise.all([
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
    db.select({ id: campuses.id, name: campuses.name }).from(campuses).where(eq(campuses.institutionId, institutionId)),
  ]);

  return (
    <StaffRequestsClient
      requests={requests.map((request) => ({
        ...request,
        campusName: request.campusName || "Main",
        requestedFields: request.requestedFields as Record<string, string | number>,
        createdAt: request.createdAt.toISOString(),
      }))}
      campuses={allCampuses}
    />
  );
}
