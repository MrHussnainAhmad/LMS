// Portable streaming archive inside the authenticated N360GCM1 encryption envelope.
// No executable archive paths, links or arbitrary filesystem extraction.
import { constants } from "node:fs";
import { open, lstat, readdir, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { backupFileSha256 } from "./central-backup-crypto";
export const MAX_RECOVERY_BYTES = 64 * 1024 * 1024 * 1024;
const MAGIC = Buffer.from("N360PKG1");
type Entry = { name: string; size: number; sha256: string };
export type RecoveryManifest = {
  version: 1;
  runId: string;
  createdAt: string;
  applicationVersion: string;
  postgresMajor: number;
  entries: Entry[];
};
const allowedSecret = (name: string) =>
  /^(STREAMING_CREDENTIALS_|STUDENT_QR_|GOOGLE_DRIVE_|CLOUDINARY_|GMAIL_|B2_)/.test(
    name,
  ) ||
  [
    "JWT_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_DOMAIN",
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "APP_DOMAIN",
    "PUBLIC_SITE_BASE_DOMAIN",
    "API_ALLOWED_ORIGINS",
    "PAYMENT_PUBLIC_ORIGIN",
    "EXPO_ACCESS_TOKEN",
  ].includes(name);
export function recoveryConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      (pair): pair is [string, string] =>
        allowedSecret(pair[0]) && typeof pair[1] === "string",
    ),
  );
}
function safeName(name: string) {
  return (
    ["database.dump", "recovery.json"].includes(name) ||
    (name.startsWith("downloads/") &&
      name.length < 400 &&
      !name.includes("\\") &&
      !name.includes(":") &&
      ![...name].some((c) => c.charCodeAt(0) < 32) &&
      name
        .split("/")
        .every(
          (part) =>
            part &&
            part !== "." &&
            part !== ".." &&
            !part.startsWith(".") &&
            !part.endsWith(".") &&
            !part.endsWith(" ") &&
            !/[<>"|?*]/.test(part) &&
            !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
        ))
  );
}
export async function createRecoveryPackage(
  dump: string,
  output: string,
  runId: string,
  signal?: AbortSignal,
  downloads = path.resolve("public/downloads"),
) {
  const memory = Buffer.from(
    JSON.stringify({ version: 1, environment: recoveryConfiguration() }),
  );
  if (memory.length > 1024 * 1024)
    throw Error("Recovery configuration exceeds limit");
  const sources: { entry: Entry; file?: string; bytes?: Buffer }[] = [];
  const add = async (name: string, file: string) => {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)
      throw Error("Unsupported backup file");
    sources.push({
      entry: {
        name,
        size: info.size,
        sha256: await backupFileSha256(file, signal),
      },
      file,
    });
  };
  await add("database.dump", dump);
  sources.push({
    entry: {
      name: "recovery.json",
      size: memory.length,
      sha256: createHash("sha256").update(memory).digest("hex"),
    },
    bytes: memory,
  });
  async function walk(directory: string, relative = "") {
    const items = await readdir(directory, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT" && !relative) return [];
        throw error;
      },
    );
    for (const item of items) {
      signal?.throwIfAborted();
      const suffix = relative ? relative + "/" + item.name : item.name;
      const name = "downloads/" + suffix;
      if (!safeName(name) || item.isSymbolicLink())
        throw Error("Unsupported download path");
      if (item.isDirectory())
        await walk(path.join(directory, item.name), suffix);
      else await add(name, path.join(directory, item.name));
      if (sources.length > 10_000) throw Error("Too many recovery files");
    }
  }
  await walk(downloads);
  if (
    sources.reduce((total, s) => total + s.entry.size, 0) >
    MAX_RECOVERY_BYTES - 4 * 1024 * 1024
  )
    throw Error("Recovery package exceeds limit");
  const manifest: RecoveryManifest = {
    version: 1,
    runId,
    createdAt: new Date().toISOString(),
    applicationVersion:
      process.env.NISAAB360_BUILD_ID ||
      process.env.APP_RELEASE_REVISION ||
      (
        await readFile(".next/BUILD_ID", "utf8").catch(() => "unrecorded")
      ).trim(),
    postgresMajor: 16,
    entries: sources.map((s) => s.entry),
  };
  const metadata = Buffer.from(JSON.stringify(manifest));
  if (metadata.length > 2 * 1024 * 1024)
    throw Error("Recovery manifest exceeds limit");
  const header = Buffer.alloc(12);
  MAGIC.copy(header);
  header.writeUInt32BE(metadata.length, 8);
  const target = await open(output, "wx", 0o600);
  try {
    await target.writeFile(header);
    await target.writeFile(metadata);
    for (const source of sources) {
      signal?.throwIfAborted();
      const hash = createHash("sha256");
      let size = 0;
      if (source.bytes) {
        hash.update(source.bytes);
        size = source.bytes.length;
        await target.writeFile(source.bytes);
      } else {
        const handle = await open(
          source.file!,
          constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
        );
        try {
          const info = await handle.stat();
          if (!info.isFile() || info.nlink !== 1)
            throw Error("Unsupported source");
          for await (const bytes of handle.createReadStream({
            autoClose: false,
          })) {
            signal?.throwIfAborted();
            hash.update(bytes);
            size += bytes.length;
            if (size > source.entry.size) throw Error("Source changed");
            await target.writeFile(bytes);
          }
        } finally {
          await handle.close();
        }
      }
      if (
        size !== source.entry.size ||
        hash.digest("hex") !== source.entry.sha256
      )
        throw Error("Source changed while packing");
    }
    await target.sync();
    return manifest;
  } finally {
    await target.close();
  }
}
export async function extractRecoveryPackage(
  source: string,
  destination: string,
): Promise<RecoveryManifest> {
  const input = await open(source, "r");
  let position = 0;
  const read = async (size: number) => {
    const buffer = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const result = await input.read(buffer, offset, size - offset, position);
      if (!result.bytesRead) throw Error("Truncated recovery package");
      offset += result.bytesRead;
      position += result.bytesRead;
    }
    return buffer;
  };
  try {
    const header = await read(12);
    const length = header.readUInt32BE(8);
    if (
      !header.subarray(0, 8).equals(MAGIC) ||
      length > 2 * 1024 * 1024 ||
      length < 2
    )
      throw Error("Unsupported recovery package");
    const manifest = JSON.parse(
      (await read(length)).toString("utf8"),
    ) as RecoveryManifest;
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.entries) ||
      manifest.entries.length > 10_000 ||
      !/^[-A-Za-z0-9_]{1,128}$/.test(manifest.runId) ||
      manifest.postgresMajor !== 16
    )
      throw Error("Unsupported recovery manifest");
    const names = new Set<string>();
    let total = 0;
    for (const entry of manifest.entries) {
      if (
        typeof entry.name !== "string" ||
        !safeName(entry.name) ||
        names.has(entry.name.toLowerCase()) ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
      )
        throw Error("Unsafe recovery entry");
      names.add(entry.name.toLowerCase());
      total += entry.size;
    }
    if (
      !names.has("database.dump") ||
      !names.has("recovery.json") ||
      total > MAX_RECOVERY_BYTES - 4 * 1024 * 1024 ||
      manifest.entries.find((e) => e.name === "recovery.json")!.size >
        1024 * 1024
    )
      throw Error("Invalid recovery contents");
    if ((await input.stat()).size !== 12 + length + total)
      throw Error("Recovery package length mismatch");
    await mkdir(destination, { recursive: false, mode: 0o700 });
    for (const entry of manifest.entries) {
      const file = path.join(destination, ...entry.name.split("/"));
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const target = await open(file, "wx", 0o600);
      const hash = createHash("sha256");
      let remaining = entry.size;
      try {
        while (remaining) {
          const bytes = await read(Math.min(remaining, 1024 * 1024));
          hash.update(bytes);
          await target.writeFile(bytes);
          remaining -= bytes.length;
        }
        await target.sync();
      } finally {
        await target.close();
      }
      if (hash.digest("hex") !== entry.sha256)
        throw Error("Recovery entry integrity mismatch");
    }
    return manifest;
  } finally {
    await input.close();
  }
}
export function validateRecoveredConfiguration(
  value: unknown,
): Record<string, string> {
  const candidate = value as {
    version?: number;
    environment?: Record<string, unknown>;
  };
  if (
    candidate?.version !== 1 ||
    !candidate.environment ||
    typeof candidate.environment !== "object" ||
    Array.isArray(candidate.environment)
  )
    throw Error("Invalid recovery configuration");
  for (const [name, entry] of Object.entries(candidate.environment))
    if (
      !/^[A-Z0-9_]+$/.test(name) ||
      !allowedSecret(name) ||
      typeof entry !== "string" ||
      entry.length > 100_000
    )
      throw Error("Invalid recovery secret");
  if (!candidate.environment.STREAMING_CREDENTIALS_SECRET)
    throw Error("Credential decryption key is missing");
  return candidate.environment as Record<string, string>;
}
