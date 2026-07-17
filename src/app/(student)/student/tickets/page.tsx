import { TicketsClient } from "@/components/tickets/TicketsClient";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StudentTicketsPage() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT" || !session.institutionId) redirect("/login");
  return <TicketsClient />;
}
