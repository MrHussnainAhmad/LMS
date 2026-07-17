import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tickets, ticketHistory } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/auth";
import { z } from "zod";

const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(1, "Description is required"),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== "STUDENT" && user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTickets = await db.select()
      .from(tickets)
      .where(and(
        eq(tickets.creatorId, user.userId),
        eq(tickets.creatorRole, user.role)
      ))
      .orderBy(desc(tickets.createdAt));

    return NextResponse.json({ tickets: userTickets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user || (user.role !== "STUDENT" && user.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (!user.institutionId) {
      return NextResponse.json({ error: "Institution not found" }, { status: 400 });
    }

    const body = await req.json();
    const { title, description } = createTicketSchema.parse(body);

    const [ticket] = await db.insert(tickets).values({
      institutionId: user.institutionId,
      creatorRole: user.role,
      creatorId: user.userId,
      title,
      description,
      status: "OPEN",
    }).returning({ id: tickets.id });

    await db.insert(ticketHistory).values({
      ticketId: ticket.id,
      actorRole: user.role,
      actorId: user.userId,
      action: "CREATED",
      notes: "Ticket created",
    });

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
