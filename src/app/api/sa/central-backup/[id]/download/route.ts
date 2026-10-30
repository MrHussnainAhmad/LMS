import { NextResponse } from "next/server";
import { pool } from "@/db";
import { requireRole } from "@/lib/rbac";
import { downloadCentralBackup } from "@/lib/central-drive-backups";
import { withRateLimit } from "@/lib/rate-limit";
export const GET = requireRole(
  ["SUPER_ADMIN"],
  async (req, { params }) => {
    if (!(await withRateLimit(req, "export", "database-download")).success)
      return NextResponse.json(
        { error: "Too many downloads" },
        { status: 429 },
      );
    const { id } = await params;
    const value = Number(id);
    if (!Number.isSafeInteger(value) || value <= 0)
      return NextResponse.json({ error: "Invalid backup" }, { status: 400 });
    const {
      rows: [row],
    } = await pool.query(
      "SELECT drive_file_id,file_name FROM central_database_backups WHERE id=$1 AND drive_verified_at IS NOT NULL AND deleted_at IS NULL",
      [value],
    );
    if (
      !row ||
      !/^database-[-0-9a-f]+\.(?:n360backup|dump\.enc)$/.test(row.file_name)
    )
      return NextResponse.json(
        { error: "Backup unavailable" },
        { status: 404 },
      );
    try {
      const response = await downloadCentralBackup(
        row.drive_file_id,
        req.signal,
      );
      return new Response(response.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${row.file_name}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Could not download backup from Drive" },
        { status: 503 },
      );
    }
  },
  { permission: "platform.security" },
);
