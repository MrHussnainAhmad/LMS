import { NextResponse } from "next/server";
import { db } from "@/db";
import { platformReviews } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  content: z.string().min(10).max(1000),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only INSTITUTION role can submit platform reviews
    if (session.role !== "INSTITUTION") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const institutionId = session.userId; // For role INSTITUTION, userId is the institution ID.

    const body = await req.json();
    const result = reviewSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.issues }, { status: 400 });
    }

    const { rating, content } = result.data;

    // Upsert review
    await db.insert(platformReviews).values({
      institutionId,
      rating,
      content,
    }).onConflictDoUpdate({
      target: platformReviews.institutionId,
      set: {
        rating,
        content,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({ message: "Review saved successfully" });
  } catch (error) {
    console.error("Error saving review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
