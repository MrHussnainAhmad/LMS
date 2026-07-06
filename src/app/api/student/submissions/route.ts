import { NextRequest, NextResponse } from "next/server";
import { saveStudentSubmission } from "@/app/actions/assessment-actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const assignmentId = Number(body.assignmentId);
    const fileKey = String(body.fileKey || "").trim();

    if (!Number.isInteger(assignmentId) || assignmentId <= 0 || !fileKey) {
      return NextResponse.json({ error: "Assignment and uploaded file are required" }, { status: 400 });
    }

    await saveStudentSubmission(assignmentId, fileKey);
    return NextResponse.json({ message: "Submission saved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
