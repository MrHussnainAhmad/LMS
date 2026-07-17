import { NextResponse } from "next/server";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const blogSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  content: z.string(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.string().optional().transform(str => str ? new Date(str) : undefined),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    // Roles that can view/edit: SUPER_ADMIN, EMPLOYEE
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "EMPLOYEE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allBlogs = await db.select().from(blogs).orderBy(blogs.createdAt);
    return NextResponse.json(allBlogs);
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "EMPLOYEE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = blogSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid data", details: result.error.issues }, { status: 400 });
    }

    // Ensure slug is unique
    const existingBlog = await db.select().from(blogs).where(eq(blogs.slug, result.data.slug));
    if (existingBlog.length > 0) {
      return NextResponse.json({ error: "A blog with this slug already exists" }, { status: 409 });
    }

    const newBlog = await db.insert(blogs).values({
      title: result.data.title,
      slug: result.data.slug,
      content: result.data.content,
      metaTitle: result.data.metaTitle,
      metaDescription: result.data.metaDescription,
      excerpt: result.data.excerpt,
      status: result.data.status,
      publishedAt: result.data.publishedAt,
      authorRole: session.role as any, // Enum type match
      authorId: session.userId,
    }).returning();

    return NextResponse.json(newBlog[0]);
  } catch (error) {
    console.error("Error creating blog:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
