import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

let history;

/** Read immutable pre-baseline SQL/metadata without unpacking files to disk. */
export function readLegacyFile(name, expectedHash) {
  history ??= JSON.parse(gunzipSync(readFileSync(new URL('./legacy-history.json.gz', import.meta.url))).toString('utf8'));
  const entry = Object.hasOwn(history.files, name) ? history.files[name] : null;
  if (!entry) throw new Error(`Unknown archived migration file: ${name}`);
  const bytes = Buffer.from(entry.base64, 'base64');
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error(`Archived migration checksum mismatch: ${name}`);
  }
  const text = bytes.toString('utf8');
  if (!expectedHash) return text;
  // Old deployments used both Git LF checkouts and Windows CRLF checkouts.
  // Accept only those byte-equivalent newline forms, never changed SQL.
  const lf = text.replace(/\r\n/g, '\n');
  for (const candidate of new Set([text, lf, lf.replace(/\n/g, '\r\n')])) {
    if (createHash('sha256').update(candidate).digest('hex') === expectedHash) return candidate;
  }
  throw new Error(`Applied migration was modified: ${name}`);
}
