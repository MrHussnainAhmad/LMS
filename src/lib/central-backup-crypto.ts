import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, unlink, type FileHandle } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

export function backupFileSink(file: FileHandle) {
  return new Writable({ write(chunk: Buffer, _encoding, done) {
    file.writeFile(chunk).then(() => done(), done);
  } });
}

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 },
    (error, key) => error ? reject(error) : resolve(key)));
}

// Existing wire format: N360GCM1 | salt(16) | iv(12) | tag(16) | ciphertext.
// Exclusive output creation protects existing backups; memory stays bounded.
export async function encryptCentralDump(input: string, output: string, password: string, signal?: AbortSignal) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await deriveKey(password, salt), iv);
  const file = await open(output, 'wx', 0o600);
  let complete = false;
  try {
    await file.write(Buffer.concat([Buffer.from('N360GCM1'), salt, iv, Buffer.alloc(16)]));
    await pipeline(createReadStream(input), cipher, backupFileSink(file), { signal });
    await file.write(cipher.getAuthTag(), 0, 16, 36);
    await file.sync();
    complete = true;
  } finally {
    await file.close();
    if (!complete) await unlink(output).catch(() => undefined);
  }
}

export async function decryptCentralDump(input: string, output: string, password: string) {
  const source = await open(input, 'r');
  const header = Buffer.alloc(52);
  try {
    const { bytesRead } = await source.read(header, 0, 52, 0);
    if (bytesRead !== 52 || header.subarray(0, 8).toString() !== 'N360GCM1') throw new Error('Unsupported or truncated backup');
  } finally { await source.close(); }
  const decipher = createDecipheriv('aes-256-gcm', await deriveKey(password, header.subarray(8, 24)), header.subarray(24, 36));
  decipher.setAuthTag(header.subarray(36, 52));
  const file = await open(output, 'wx', 0o600);
  let complete = false;
  try {
    await pipeline(createReadStream(input, { start: 52 }), decipher, backupFileSink(file));
    await file.sync();
    complete = true;
  } finally {
    await file.close();
    if (!complete) await unlink(output).catch(() => undefined);
  }
}

export async function backupFileSha256(filePath: string, signal?: AbortSignal) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath, { signal })) hash.update(chunk);
  return hash.digest('hex');
}

/** 18 random bytes encoded without padding: 24 characters, 144 bits. */
export function generateBackupPassword(){return randomBytes(18).toString('base64url');}
