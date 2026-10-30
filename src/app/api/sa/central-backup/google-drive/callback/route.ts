import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { pool } from "@/db";
import { requireRole } from "@/lib/rbac";
import { getJwtSecret } from "@/lib/jwt-secret";
import {
  exchangeCentralDriveCode,
  prepareCentralDriveFolder,
} from "@/lib/central-drive-backups";
import {
  secretHash,
  encryptStreamingCredentials,
} from "@/lib/central-backup-config";
export const GET = requireRole(
  ["SUPER_ADMIN"],
  async (req, { session }) => {
    const query = req.nextUrl.searchParams;
    const result = new URL("/sa/backups", req.url);
    try {
      if (query.get("error") || !query.get("code") || !query.get("state"))
        throw Error("Consent not completed");
      const { payload } = await jwtVerify(query.get("state")!, getJwtSecret(), {
        algorithms: ["HS256"],
      });
      if (
        payload.purpose !== "central-google-drive-setup" ||
        payload.sub !== String(session.userId) ||
        payload.device !== session.planDeviceSessionId ||
        typeof payload.nonce !== "string"
      )
        throw Error("Invalid state");
      const consumed = await pool.query(
        `UPDATE central_backup_settings SET oauth_state_hash=NULL,oauth_state_expires_at=NULL WHERE id=1 AND oauth_state_hash=$1 AND oauth_state_expires_at>now() RETURNING id`,
        [secretHash(payload.nonce)],
      );
      if (!consumed.rowCount) throw Error("Expired state");
      const { refreshToken } = await exchangeCentralDriveCode(
        query.get("code")!,
      );
      const drive = await prepareCentralDriveFolder(refreshToken);
      await pool.query(
        "UPDATE central_backup_settings SET drive_credentials_encrypted=$1,drive_folder_id=$2,drive_email=$3,updated_at=now() WHERE id=1",
        [
          encryptStreamingCredentials({ refreshToken }),
          drive.folderId,
          drive.email,
        ],
      );
      result.searchParams.set("drive", "connected");
    } catch {
      result.searchParams.set("drive", "failed");
    }
    const response = NextResponse.redirect(result);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  },
  { permission: "platform.security", mutatesOnRead: true },
);
