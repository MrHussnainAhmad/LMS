import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireRole } from "@/lib/rbac";

export const runtime = "nodejs";

const DOWNLOAD_DIRECTORY = path.join(process.cwd(), "public", "downloads");
const APP_FILENAME = "nisaab360-app.apk";
const APP_PATH = path.join(DOWNLOAD_DIRECTORY, APP_FILENAME);
const MAX_APP_BYTES = 200 * 1024 * 1024;

export async function GET() {
  try {
    const file = await stat(APP_PATH);
    if (!file.isFile()) throw new Error("App file is unavailable");

    return new NextResponse(await readFile(APP_PATH), {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": file.size.toString(),
        "Content-Disposition": `attachment; filename="${APP_FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "The Android app is not available yet." }, { status: 404 });
  }
}

export const POST = requireRole(["SUPER_ADMIN", "INSTITUTION_ADMIN"], async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an APK file to upload." }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".apk") || file.size <= 0 || file.size > MAX_APP_BYTES) {
      return NextResponse.json({ error: "Upload an APK file up to 200 MB." }, { status: 400 });
    }

    await mkdir(DOWNLOAD_DIRECTORY, { recursive: true });
    const temporaryPath = path.join(DOWNLOAD_DIRECTORY, `.${APP_FILENAME}.${crypto.randomUUID()}.tmp`);

    try {
      await writeFile(temporaryPath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
      await rm(APP_PATH, { force: true });
      await rename(temporaryPath, APP_PATH);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ message: "Android app replaced successfully.", filename: APP_FILENAME });
  } catch (error) {
    console.error("Android app upload failed", error);
    return NextResponse.json({ error: "Could not replace the Android app." }, { status: 500 });
  }
});
